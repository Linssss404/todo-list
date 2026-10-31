/**
 * 极简 Markdown → HTML。
 * 先转义 HTML，再按块/行处理，避免注入；只支持笔记里常用的语法。
 */

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const inline = (text, imgMap) => {
  let out = escapeHtml(text);
  // 图片 ![alt](src)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const real = imgMap && imgMap[src] ? imgMap[src] : src;
    return `<img class="md-img" alt="${alt}" src="${real}" />`;
  });
  // 链接 [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    if (!/^https?:/i.test(href)) return label;
    return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  // 行内代码
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 粗体 / 斜体
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // 删除线
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out;
};

export function renderMarkdown(source, imgMap = {}) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listType = null;
  let inCode = false;
  let codeBuf = [];
  let paragraph = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '), imgMap)}</p>`);
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (/^```/.test(line.trim())) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${inline(heading[2], imgMap)}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      closeList();
      html.push('<hr />');
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inline(quote[1], imgMap)}</blockquote>`);
      continue;
    }

    const ul = /^[-*+]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushParagraph();
      const wanted = ul ? 'ul' : 'ol';
      if (listType !== wanted) {
        closeList();
        html.push(`<${wanted}>`);
        listType = wanted;
      }
      html.push(`<li>${inline((ul || ol)[1], imgMap)}</li>`);
      continue;
    }

    const task = /^[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (task) {
      flushParagraph();
      closeList();
      html.push(
        `<div class="md-task${task[1] === ' ' ? '' : ' done'}"><span class="md-box">${
          task[1] === ' ' ? '' : '✓'
        }</span>${inline(task[2], imgMap)}</div>`
      );
      continue;
    }

    paragraph.push(line);
  }

  if (inCode && codeBuf.length) {
    html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

/** 从正文里找出所有 attachment: 引用的文件名 */
export function collectAttachments(content) {
  const out = [];
  const re = /attachment:([^\s)]+)/g;
  let m;
  while ((m = re.exec(String(content || '')))) {
    if (!out.includes(`attachments/${m[1].replace(/^attachments\//, '')}`)) {
      out.push(`attachments/${m[1].replace(/^attachments\//, '')}`);
    }
  }
  return out;
}
