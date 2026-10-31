import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { collectAttachments, renderMarkdown } from '../lib/markdown.js';

const emptyDraft = { id: null, title: '', content: '', tags: '', pinned: false, archived: false, attachments: [] };

export default function Notes({ onToast }) {
  const [rows, setRows] = useState([]);
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [drafting, setDrafting] = useState(false);
  const [mode, setMode] = useState('edit');
  const [imgMap, setImgMap] = useState({});
  const [status, setStatus] = useState('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const areaRef = useRef(null);
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  const load = async (keepId = null) => {
    const [list, tagList] = await Promise.all([
      api.notes({ q, tag: activeTag, archived: showArchived }),
      api.noteTags(),
    ]);
    setRows(list);
    setTags(tagList);
    if (keepId) {
      const found = list.find((n) => n.id === keepId);
      if (found) setDraft({ ...found });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activeTag, showArchived]);

  useEffect(() => {
    if (!rows.length) return;
    if (draft.id || drafting) return;
    setDraft({ ...rows[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* 正文里的 attachment: 引用换成可直接显示的 data URL */
  useEffect(() => {
    const paths = collectAttachments(draft.content);
    if (!paths.length) {
      setImgMap({});
      return;
    }
    let alive = true;
    api.readAttachments(paths).then((map) => {
      if (!alive) return;
      const next = {};
      for (const [path, url] of Object.entries(map)) {
        next[`attachment:${path.replace(/^attachments\//, '')}`] = url;
        next[path] = url;
      }
      setImgMap(next);
    });
    return () => {
      alive = false;
    };
  }, [draft.content]);

  const save = async (patch = {}) => {
    const merged = { ...draft, ...patch };
    setStatus('saving');
    const saved = await api.saveNote({
      id: merged.id,
      title: merged.title,
      content: merged.content,
      tags: merged.tags,
      attachments: merged.attachments,
      pinned: merged.pinned,
      archived: merged.archived,
    });
    setStatus('saved');
    setDraft((prev) => ({
      ...prev,
      id: saved.id,
      title: saved.title,
      attachments: saved.attachments,
    }));
    setDrafting(false);
    await load(saved.id);
  };

  const scheduleSave = (patch) => {
    setStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(patch), 650);
  };

  const update = (patch, immediate = false) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    if (immediate) save(patch);
    else scheduleSave(patch);
  };

  const createNew = () => {
    setDraft({ ...emptyDraft });
    setDrafting(true);
    setMode('edit');
    setTimeout(() => areaRef.current && areaRef.current.focus(), 60);
  };

  const wrapSelection = (before, after = before) => {
    const area = areaRef.current;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end, value } = area;
    const selected = value.slice(start, end) || '文字';
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    update({ content: next });
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertAtCursor = (text) => {
    const area = areaRef.current;
    if (!area) {
      update({ content: `${draft.content}\n${text}` });
      return;
    }
    const { selectionStart: start, value } = area;
    update({ content: `${value.slice(0, start)}${text}${value.slice(start)}` });
  };

  const handlePaste = async (e) => {
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const saved = await api.saveAttachment(dataUrl, 'paste');
    const name = saved.path.replace(/^attachments\//, '');
    update({ attachments: [...(draft.attachments || []), saved.path] });
    insertAtCursor(`\n![图片](attachment:${name})\n`);
    onToast && onToast('图片已存到本地附件目录');
  };

  const pickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const saved = await api.saveAttachment(dataUrl, file.name.replace(/\.[^.]+$/, ''));
    const name = saved.path.replace(/^attachments\//, '');
    update({ attachments: [...(draft.attachments || []), saved.path] });
    insertAtCursor(`\n![图片](attachment:${name})\n`);
    e.target.value = '';
  };

  const html = useMemo(() => renderMarkdown(draft.content, imgMap), [draft.content, imgMap]);

  const tagList = String(draft.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="page notes-page">
      <aside className="card panel notes-rail">
        <div className="notes-rail-head">
          <div className="notes-search">
            <Icon name="search" size={15} />
            <input value={q} placeholder="搜标题和正文" onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="primary-btn small" onClick={createNew}>
            <Icon name="plus" size={14} /> 新笔记
          </button>
        </div>

        <div className="tag-filter">
          <button className={`chip-btn${!activeTag ? ' active' : ''}`} onClick={() => setActiveTag('')}>全部</button>
          {tags.slice(0, 8).map((t) => (
            <button
              key={t.name}
              className={`chip-btn${activeTag === t.name ? ' active' : ''}`}
              onClick={() => setActiveTag(activeTag === t.name ? '' : t.name)}
            >
              #{t.name}
            </button>
          ))}
        </div>

        <div className="note-list">
          {rows.length === 0 && (
            <div className="empty small">
              <Icon name="sparkles" size={22} />
              <p>{showArchived ? '归档里是空的' : '还没有笔记，点「新笔记」'}</p>
            </div>
          )}
          {rows.map((note) => (
            <button
              key={note.id}
              className={`note-card${draft.id === note.id ? ' active' : ''}`}
              onClick={() => {
                setDraft({ ...note });
                setDrafting(false);
                setMode('edit');
              }}
            >
              <div className="note-card-top">
                {note.pinned && <Icon name="flag" size={12} className="pin-mark" />}
                <strong>{note.title || '无标题'}</strong>
              </div>
              {note.excerpt && <p>{note.excerpt}</p>}
              <div className="note-card-foot">
                {String(note.tags || '')
                  .split(',')
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((t) => (
                    <span className="tag" key={t}>#{t.trim()}</span>
                  ))}
                <em>{String(note.updatedAt).slice(5, 10).replace('-', '/')}</em>
              </div>
            </button>
          ))}
        </div>

        <button className="ghost-btn wide" onClick={() => setShowArchived((v) => !v)}>
          <Icon name="folder" size={15} /> {showArchived ? '回到笔记' : '查看归档'}
        </button>
      </aside>

      <section className="card panel note-editor">
        {draft.id || drafting ? (
          <>
            <header className="note-editor-head">
              <span className={`save-state ${status}`}>
                {status === 'saving' ? '保存中…' : status === 'saved' ? '已自动保存' : ''}
              </span>
              <div className="note-actions">
                <button
                  className={`icon-btn${draft.pinned ? ' on' : ''}`}
                  title={draft.pinned ? '取消置顶' : '置顶'}
                  onClick={() => update({ pinned: !draft.pinned }, true)}
                >
                  <Icon name="flag" size={16} />
                </button>
                {draft.id && (
                  <>
                    <button
                      className="ghost-btn"
                      onClick={async () => {
                        const res = await api.noteToTodo(draft.id);
                        onToast && onToast(`已生成待办「${res.title}」`);
                      }}
                    >
                      <Icon name="check" size={14} /> 转待办
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => update({ archived: !draft.archived }, true)}
                    >
                      {draft.archived ? '取消归档' : '归档'}
                    </button>
                    <button
                      className={`ghost-btn danger${confirmDelete ? ' armed' : ''}`}
                      onClick={async () => {
                        if (!confirmDelete) {
                          setConfirmDelete(true);
                          return;
                        }
                        await api.removeNote(draft.id);
                        setDraft({ ...emptyDraft });
                        setDrafting(false);
                        setConfirmDelete(false);
                        await load();
                      }}
                    >
                      <Icon name="trash" size={14} /> {confirmDelete ? '再点一次删除' : '删除'}
                    </button>
                  </>
                )}
              </div>
            </header>

            <input
              className="note-title"
              value={draft.title}
              placeholder="标题"
              onChange={(e) => update({ title: e.target.value })}
            />

            <div className="note-meta-row">
              <Icon name="folder" size={14} />
              <input
                className="note-tags"
                value={draft.tags}
                placeholder="标签，用逗号分隔，比如 想法,读书"
                onChange={(e) => update({ tags: e.target.value })}
              />
            </div>

            <div className="md-toolbar">
              <div className="seg small">
                <button className={`seg-item${mode === 'edit' ? ' active' : ''}`} onClick={() => setMode('edit')}>编辑</button>
                <button className={`seg-item${mode === 'preview' ? ' active' : ''}`} onClick={() => setMode('preview')}>预览</button>
              </div>
              <div className="md-tools">
                <button title="粗体" onClick={() => wrapSelection('**')}>B</button>
                <button title="斜体" onClick={() => wrapSelection('*')}><em>I</em></button>
                <button title="标题" onClick={() => insertAtCursor('\n## 小标题\n')}>H</button>
                <button title="列表" onClick={() => insertAtCursor('\n- 第一条\n- 第二条\n')}>≡</button>
                <button title="引用" onClick={() => insertAtCursor('\n> 引用\n')}>”</button>
                <button title="代码" onClick={() => insertAtCursor('\n```\ncode\n```\n')}>{'</>'}</button>
                <label className="md-img-btn" title="插入图片">
                  <Icon name="plus" size={14} /> 图片
                  <input type="file" accept="image/*" hidden onChange={pickImage} />
                </label>
              </div>
            </div>

            {mode === 'edit' ? (
              <textarea
                ref={areaRef}
                className="md-area"
                value={draft.content}
                placeholder="想到什么写什么，支持 Markdown；图片可以直接粘贴进来"
                onChange={(e) => update({ content: e.target.value })}
                onPaste={handlePaste}
              />
            ) : (
              <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
            )}

            {(draft.attachments || []).length > 0 && (
              <div className="attach-strip">
                {draft.attachments.map((path) => (
                  <span className="attach-chip" key={path}>
                    <Icon name="folder" size={12} /> {path.replace(/^attachments\//, '')}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <Icon name="note" size={28} />
            <p>左边选一篇，或者新建一篇</p>
            <button className="primary-btn" onClick={createNew}>
              <Icon name="plus" size={15} /> 写第一篇
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
