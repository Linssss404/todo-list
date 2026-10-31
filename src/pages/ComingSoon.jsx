import Icon from '../components/Icon.jsx';

const MODULES = {
  money: {
    icon: 'wallet',
    title: '记账',
    lead: '记一笔只要三秒，月末不用再翻账单。',
    items: [
      '支出 / 收入双向记录，金额支持分',
      '自定义分类，颜色和图标自己定',
      '商家、备注、标签，想查哪笔都能翻到',
      '一个月度总预算，超了首页直接提示',
      '月度趋势 + 分类占比图',
      '一键导出 CSV，随时给 Excel 看',
    ],
  },
  calendar: {
    icon: 'calendar',
    title: '日程',
    lead: '日历上只有一份时间：日程和待办的截止。',
    items: [
      '月历视图 + 点开某天看详情',
      '周视图时间轴，看得清一天的空档',
      '全天事件和带时间段的事件都支持',
      '待办加了截止时间，自动出现在日历上',
      '重复日程（每天 / 每周 / 每月）',
      '提前 5 分钟到 1 天，自己设提醒',
    ],
  },
  notes: {
    icon: 'sparkles',
    title: '灵感',
    lead: '想到就写，不用先想放哪个文件夹。',
    items: [
      'Markdown 写、Markdown 看',
      '标签 + 全文搜索，找得回来',
      '置顶和归档，常用想法一直在上面',
      '图片直接拖进来',
      '一句话就能转成待办',
    ],
  },
};

export default function ComingSoon({ module }) {
  const data = MODULES[module];
  if (!data) return null;

  return (
    <div className="page coming">
      <section className="card panel coming-card">
        <div className="coming-head">
          <span className="coming-icon">
            <Icon name={data.icon} size={26} />
          </span>
          <div>
            <span className="badge">下一阶段</span>
            <h1>{data.title}</h1>
            <p className="muted">{data.lead}</p>
          </div>
        </div>

        <ul className="feature-list">
          {data.items.map((item) => (
            <li key={item}>
              <span className="tick">
                <Icon name="check" size={12} strokeWidth={2.6} />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="coming-foot">
          <Icon name="arrow" size={15} />
          <span>先把待办模块用顺手，你点头我就接着写这一块。</span>
        </div>
      </section>
    </div>
  );
}
