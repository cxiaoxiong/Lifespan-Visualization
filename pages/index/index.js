const WEEKS_PER_YEAR = 52;
const WEEKS_PER_DECADE = 10 * WEEKS_PER_YEAR; // 520
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 里程碑年龄（对应整岁生日的周，金色标记）
const MILESTONE_AGES = [18, 30, 60, 80];

// 每日一句正能量格言
const QUOTES = [
  '你只管努力，时间自有答案',
  '热爱可抵岁月漫长',
  '种一棵树最好的时间是十年前，其次是现在',
  '生活明朗，万物可爱',
  '慢慢来，比较快',
  '每一天都是你最年轻的一天',
  '眼里有光，心中有爱',
  '心之所向，素履以往',
  '去做你害怕的事，害怕自会消失',
  '日拱一卒，功不唐捐'
];

// 海报周点配色（与 index.wxss 语义色保持一致）
const POSTER_COLORS = {
  passed: '#c9a13b',
  future: '#dfe3e8',
  milestone: '#d9574f'
};

// 引导页演示行的柔和彩色（与图例「未来的一周」渐变同款色系）
const DEMO_PASTELS = ['#ff9a9e', '#fad0c4', '#a18cd1', '#fbc2eb', '#8fd3f4'];

// 生成一个随机颜色（HSL，与原网页 getRandomColor 一致）
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 30); // 70-100%
  const lightness = 60 + Math.floor(Math.random() * 20); // 60-80%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// 把 Date 格式化为 YYYY-MM-DD
function formatDate(d) {
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 千分位格式化：12345 → 12,345
function formatThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 随机彩虹渐变字符串（标题与进度条共用，每次刷新颜色都不同）
function randomGradient() {
  const colors = [];
  for (let i = 0; i < 5; i++) {
    colors.push(getRandomColor());
  }
  return `linear-gradient(to right, ${colors.join(', ')})`;
}

Page({
  data: {
    birthdate: '1990-01-01',
    needBirthday: false, // 首次打开显示引导页
    lifespans: [60, 70, 80, 90, 100],
    lifespanLabels: ['60 年', '70 年', '80 年', '90 年', '100 年'],
    lifespan: 80,
    lifespanIndex: 2, // 对应 80 岁
    decades: [],
    demoWeeks: [],
    stats: {
      passedPercent: '',
      passedWeeks: 0,
      remainWeeks: 0,
      remainYears: '',
      lifeLine: ''
    },
    passedPercent: 0,
    futurePercent: 0,
    gradient: '',
    quote: ''
  },

  onLoad() {
    // 开启右上角「···」菜单里的「转发给朋友」和「分享到朋友圈」两个入口
    // 注意：不调用 wx.showShareMenu 时，即使定义了 onShareTimeline，朋友圈入口也不会显示
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    const savedBirthdate = wx.getStorageSync('birthdate');
    const savedLifespan = wx.getStorageSync('lifespan');

    const patch = {};

    if (savedBirthdate) {
      patch.birthdate = savedBirthdate;
      patch.needBirthday = false;
    } else {
      // 首次打开：只显示引导页，不渲染周历
      patch.needBirthday = true;
    }

    if (savedLifespan) {
      const index = this.data.lifespans.indexOf(savedLifespan);
      if (index >= 0) {
        patch.lifespan = savedLifespan;
        patch.lifespanIndex = index;
      }
    }

    this.setData(patch);

    // 每日一句格言：按一年中的第几天轮换，同一天内保持不变
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / MS_PER_DAY);
    // 渐变提前生成：首次打开显示引导页时不走 updateCalendar，标题也要有颜色
    // 引导页演示行：52 个圆点 = 一年，前半年金色（已过），后半年柔和彩色（未来），白点标记「现在」
    const demoWeeks = [];
    const halfYear = WEEKS_PER_YEAR / 2;
    for (let i = 0; i < WEEKS_PER_YEAR; i++) {
      demoWeeks.push({
        i,
        isNow: i === halfYear - 1,
        color: i === halfYear - 1 ? '' : i < halfYear ? '#c9a13b' : DEMO_PASTELS[i % DEMO_PASTELS.length]
      });
    }
    this.setData({ quote: QUOTES[dayOfYear % QUOTES.length], gradient: randomGradient(), demoWeeks });

    if (!patch.needBirthday) {
      this.updateCalendar();
    }
  },

  onReady() {
    // 主页面渲染完成后，静默预生成分享海报（供分享时带图）
    if (!this.data.needBirthday) {
      this.preGeneratePoster();
    }
  },

  // —— 首次引导页 ——
  onOnboardDateChange(e) {
    this.setData({ birthdate: e.detail.value });
  },

  onOnboardLifespanChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      lifespanIndex: index,
      lifespan: this.data.lifespans[index]
    });
  },

  onOnboardConfirm() {
    wx.setStorageSync('birthdate', this.data.birthdate);
    wx.setStorageSync('lifespan', this.data.lifespan);
    this.setData({ needBirthday: false });
    this.updateCalendar();
    this.preGeneratePoster();
  },

  // —— 主页面 ——
  onDateChange(e) {
    const birthdate = e.detail.value;
    wx.setStorageSync('birthdate', birthdate);
    this.setData({ birthdate });
    this.updateCalendar();
  },

  onLifespanChange(e) {
    const index = Number(e.detail.value);
    wx.setStorageSync('lifespan', this.data.lifespans[index]);
    this.setData({
      lifespanIndex: index,
      lifespan: this.data.lifespans[index]
    });
    this.updateCalendar();
  },

  // 唯一的周点分类函数：WXML 数据与 canvas 海报共用，保证颜色语义一致
  getWeekState(totalWeek) {
    const totalWeeks = this.data.lifespan * WEEKS_PER_YEAR;
    // 本周 = 正在度过的这一周，位于黑白交界处；时间轴全部走完时无标记
    if (totalWeek === this._ageInWeeks && this._ageInWeeks < totalWeeks) return 'now';
    // 里程碑 = 整岁生日的周（18/30/60/80 岁），金色标记；已过的里程碑仍保持金色
    if (
      totalWeek > 0 &&
      totalWeek % WEEKS_PER_YEAR === 0 &&
      MILESTONE_AGES.indexOf(totalWeek / WEEKS_PER_YEAR) >= 0
    ) {
      return 'milestone';
    }
    if (totalWeek < this._ageInWeeks) return 'passed';
    return 'future';
  },

  updateCalendar() {
    const { birthdate, lifespan } = this.data;
    const totalWeeks = lifespan * WEEKS_PER_YEAR;
    const decadeCount = Math.floor(lifespan / 10); // 兜底：将来开放任意跨度也不会出非整数块

    // 用 '/' 解析为本地时间，避免 iOS 上按 UTC 解析导致日期偏移
    const birth = new Date(birthdate.replace(/-/g, '/'));
    const today = new Date();

    let ageInWeeks = Math.floor((today - birth) / MS_PER_WEEK);
    // 边界保护：出生日期在未来 / 超过时间跨度时，避免负数和超界
    ageInWeeks = Math.max(0, Math.min(ageInWeeks, totalWeeks));
    this._ageInWeeks = ageInWeeks;

    const remainingWeeks = totalWeeks - ageInWeeks;

    // 人生进度一句话：天数比周数更有冲击力
    const rawDays = Math.floor((today - birth) / MS_PER_DAY);
    const dayNumber = Math.max(1, rawDays + 1);
    const remainingDays = Math.max(0, totalWeeks * 7 - rawDays);
    const lifeLine = `今天是你来到世界的第 ${formatThousands(dayNumber)} 天 · 未来还有约 ${formatThousands(remainingDays)} 天`;

    const stats = {
      passedPercent: ((ageInWeeks / totalWeeks) * 100).toFixed(1) + '%',
      passedWeeks: ageInWeeks,
      remainWeeks: remainingWeeks,
      remainYears: (remainingWeeks / WEEKS_PER_YEAR).toFixed(1),
      lifeLine
    };

    const passedPercent = (ageInWeeks / totalWeeks) * 100;
    const futurePercent = 100 - passedPercent;

    const gradient = randomGradient();

    const decades = [];
    for (let i = 0; i < decadeCount; i++) {
      const weeks = [];
      for (let j = 0; j < WEEKS_PER_DECADE; j++) {
        const totalWeek = i * WEEKS_PER_DECADE + j;
        const state = this.getWeekState(totalWeek);
        const week = { state, totalWeek };
        if (state === 'future') {
          week.color = getRandomColor();
          week.style = `background-color: ${week.color}`;
        }
        weeks.push(week);
      }
      decades.push({
        label: `${i * 10}–${i * 10 + 9}岁`,
        weeks
      });
    }

    this.setData({ decades, stats, passedPercent, futurePercent, gradient });
  },

  onWeekTap(e) {
    const totalWeek = Number(e.currentTarget.dataset.totalweek);
    const birth = new Date(this.data.birthdate.replace(/-/g, '/'));
    const date = new Date(birth.getTime());
    date.setDate(date.getDate() + totalWeek * 7);
    const dateText = formatDate(date);

    const years = Math.floor(totalWeek / WEEKS_PER_YEAR);
    const months = Math.floor((totalWeek % WEEKS_PER_YEAR) / 4.33);
    const isBirthdayWeek = totalWeek > 0 && totalWeek % WEEKS_PER_YEAR === 0;
    const isNow = totalWeek === this._ageInWeeks;

    let content;
    if (isNow) {
      content = `现在 · ${dateText}\n你正在度过的这一周`;
    } else if (totalWeek === 0) {
      content = `${dateText}\n你出生的一周`;
    } else if (isBirthdayWeek) {
      content = `🎉 你 ${years} 岁生日的一周\n${dateText}`;
    } else if (totalWeek < this._ageInWeeks) {
      content = `${dateText}\n那时你 ${years} 岁 ${months} 个月`;
    } else {
      content = `${dateText}\n届时你 ${years} 岁`;
    }

    wx.showModal({
      title: '这一周',
      content,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // —— 分享海报 ——
  onSavePoster() {
    this.generatePoster(true);
  },

  preGeneratePoster() {
    // 等待主页面 canvas 渲染完成再绘制
    setTimeout(() => {
      if (!this.data.needBirthday) {
        this.generatePoster(false);
      }
    }, 300);
  },

  generatePoster(save) {
    const query = wx.createSelectorQuery().in(this);
    query.select('#poster').fields({ node: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        return; // 画布尚未就绪（例如仍在引导页）
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      let dpr = 2;
      try {
        dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
      } catch (e) {}

      const W = 750; // 海报逻辑宽度
      const pitch = 11; // 相邻点中心距
      const r = 4; // 点半径
      const cols = WEEKS_PER_YEAR; // 52
      const rowsPerDecade = WEEKS_PER_DECADE / cols; // 10
      const gridW = cols * pitch;
      const startX = (W - gridW) / 2;

      const headerH = 150;
      const labelH = 40;
      const decadeGap = 16;
      const decadeH = rowsPerDecade * pitch;
      const footerH = 170;

      const decades = this.data.decades;
      const H = headerH + decades.length * (labelH + decadeH + decadeGap) + footerH;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // 标题（与页面同款随机彩虹渐变）
      const titleGradient = ctx.createLinearGradient(0, 0, W, 0);
      for (let i = 0; i < 5; i++) {
        titleGradient.addColorStop(i / 4, getRandomColor());
      }
      ctx.fillStyle = titleGradient;
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('余生很贵，请别浪费', W / 2, 70);

      ctx.fillStyle = '#999999';
      ctx.font = '24px sans-serif';
      ctx.fillText(`出生 ${this.data.birthdate} · 跨度 ${this.data.lifespan} 年`, W / 2, 112);

      // 周历网格
      let y = headerH;
      decades.forEach((decade) => {
        ctx.fillStyle = '#333333';
        ctx.font = '22px sans-serif';
        ctx.fillText(decade.label, W / 2, y + 20);

        const gridTop = y + labelH - 8;
        decade.weeks.forEach((w, j) => {
          const row = Math.floor(j / cols);
          const col = j % cols;
          const x = startX + col * pitch;
          const cy = gridTop + row * pitch;
          if (w.state === 'now') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#111111';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          } else if (w.state === 'future' && w.color) {
            ctx.fillStyle = w.color;
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = POSTER_COLORS[w.state] || POSTER_COLORS.future;
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        y += labelH + decadeH + decadeGap;
      });

      // 底部统计
      const s = this.data.stats;
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`已过 ${s.passedPercent} · 未来约 ${s.remainYears} 年`, W / 2, y + 16);
      ctx.fillStyle = '#777777';
      ctx.font = '22px sans-serif';
      ctx.fillText(`已过 ${s.passedWeeks} 周 · 未来 ${s.remainWeeks} 周`, W / 2, y + 48);
      ctx.fillText('把握当下，未来可期', W / 2, y + 82);

      wx.canvasToTempFilePath({
        canvas,
        fileType: 'png',
        success: (r) => {
          this.posterPath = r.tempFilePath;
          if (save) {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: (err) => this.handleSaveFail(err)
            });
          }
        },
        fail: () => wx.showToast({ title: '海报生成失败', icon: 'none' })
      });
    });
  },

  handleSaveFail(err) {
    const msg = (err && err.errMsg) || '';
    if (msg.indexOf('auth') >= 0 || msg.indexOf('authorize') >= 0 || msg.indexOf('deny') >= 0) {
      wx.showModal({
        title: '需要相册权限',
        content: '请开启「保存到相册」权限后再试',
        confirmText: '去设置',
        success: (r) => {
          if (r.confirm) wx.openSetting();
        }
      });
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onShareAppMessage() {
    const share = {
      title: `我已走过人生的 ${this.data.stats.passedPercent}，你呢？`,
      path: '/pages/index/index'
    };
    if (this.posterPath) share.imageUrl = this.posterPath;
    return share;
  },

  onShareTimeline() {
    const share = {
      title: '余生很贵，请别浪费——把时间画成一张图'
    };
    if (this.posterPath) share.imageUrl = this.posterPath;
    return share;
  }
});
