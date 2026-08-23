const WEEKS_PER_YEAR = 52;
const WEEKS_PER_DECADE = 10 * WEEKS_PER_YEAR; // 520
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.2425 * MS_PER_DAY; // 平均回归年，用于顶部生命计时器

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

// 生成一个随机颜色（随机色相/饱和度/亮度，输出 hex）。
// 注意：canvas 的 addColorStop/fillStyle 在真机 iOS 上对 hsl() 支持不稳定，
// 会抛异常导致海报静默失败，所以统一转成 hex（CSS 与 canvas 都兼容）。
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return ('0' + Math.round(255 * c).toString(16)).slice(-2);
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 30); // 70-100%
  const lightness = 60 + Math.floor(Math.random() * 20); // 60-80%
  return hslToHex(hue, saturation, lightness);
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

// 圆角矩形路径（canvas 海报用，兼容性优于原生 ctx.roundRect）
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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
    quote: '',
    elapsedParts: [],
    elapsedSec: '00.00',
    remainParts: [],
    remainSec: '00.00'
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
      this.startLifeTimer();
    }
  },

  onReady() {
    // 主页面渲染完成后，静默预生成分享海报（供分享时带图）
    if (!this.data.needBirthday) {
      this.preGeneratePoster();
    }
  },

  onShow() {
    // 回到前台时恢复计时器（Date.now() 绝对时间计算，数值自动连续）
    if (!this.data.needBirthday) {
      this.startLifeTimer();
    }
  },

  onHide() {
    this.stopLifeTimer();
  },

  onUnload() {
    this.stopLifeTimer();
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
    this.startLifeTimer();
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

    // 缓存生命计时器的起止时刻（绝对时间，供顶部计时器每 tick 计算）
    this._birthMs = birth.getTime();
    this._endMs = this._birthMs + lifespan * MS_PER_YEAR;

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

  // —— 顶部生命计时器：已活（累计）+ 剩余（倒数），每 10ms 刷新 ——
  startLifeTimer() {
    this.stopLifeTimer();
    this._tickLifeTimer();
    this._lifeTimer = setInterval(() => this._tickLifeTimer(), 10);
  },

  stopLifeTimer() {
    if (this._lifeTimer) {
      clearInterval(this._lifeTimer);
      this._lifeTimer = null;
    }
  },

  // 用 Date.now() 绝对时间计算，不累加计数器，避免 setInterval 漂移
  _tickLifeTimer() {
    if (this.data.needBirthday || !this._birthMs || !this._endMs) return;
    const now = Date.now();
    const elapsed = Math.max(0, now - this._birthMs);
    const remain = Math.max(0, this._endMs - now);

    const e = this._formatDuration(elapsed);
    const r = this._formatDuration(remain);

    const patch = { elapsedSec: e.sec, remainSec: r.sec };
    // 「天 时 分」只在分钟边界变化时才更新，避免高频 setData
    const eKey = e.parts.map((p) => p.num).join('');
    if (eKey !== this._elapsedKey) {
      this._elapsedKey = eKey;
      patch.elapsedParts = e.parts;
    }
    const rKey = r.parts.map((p) => p.num).join('');
    if (rKey !== this._remainKey) {
      this._remainKey = rKey;
      patch.remainParts = r.parts;
    }
    this.setData(patch);
  },

  // 把毫秒拆成 { parts: [{ num, unit }], sec: 'SS.xx' }（数字与单位分离，便于只给数字染色）
  _formatDuration(ms) {
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const day = Math.floor(ms / MS_PER_DAY);
    let rest = ms - day * MS_PER_DAY;
    const hour = Math.floor(rest / (60 * 60 * 1000));
    rest -= hour * 60 * 60 * 1000;
    const min = Math.floor(rest / (60 * 1000));
    rest -= min * 60 * 1000;
    const sec = Math.floor(rest / 1000);
    const centis = Math.floor((rest % 1000) / 10);

    return {
      parts: [
        { num: formatThousands(day), unit: '天' },
        { num: pad(hour), unit: '时' },
        { num: pad(min), unit: '分' }
      ],
      sec: `${pad(sec)}.${pad(centis)}`
    };
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
        console.error('[海报] 画布未就绪', res);
        wx.showToast({ title: '海报生成失败', icon: 'none' });
        return; // 画布尚未就绪（例如仍在引导页）
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[海报] getContext 返回 null');
        wx.showToast({ title: '海报生成失败', icon: 'none' });
        return;
      }
      // dpr 上限压到 2：高 DPR 屏（iPhone 等 pixelRatio=3）时画布物理高度会到
      // 1648 * 3 = 4944px，超过 iOS 约 4096px 的 canvas 上限，导致导出静默失败。
      let dpr = 2;
      try {
        dpr = Math.min((wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2, 2);
      } catch (e) {}

      const W = 750; // 海报逻辑宽度
      const pitch = 11; // 相邻点中心距
      const r = 4; // 点半径
      const cols = WEEKS_PER_YEAR; // 52
      const rowsPerDecade = WEEKS_PER_DECADE / cols; // 10
      const gridW = cols * pitch;
      const startX = (W - gridW) / 2;

      const headerH = 185;
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
      ctx.fillText('余生很贵，请别浪费', W / 2, 62);

      ctx.fillStyle = '#999999';
      ctx.font = '24px sans-serif';
      ctx.fillText(`出生 ${this.data.birthdate} · 跨度 ${this.data.lifespan} 年`, W / 2, 100);

      // —— 人生进度条（与页面一致：黑色=已过，彩虹渐变=未来）——
      const barX = 70;
      const barY = 118;
      const barW = W - barX * 2;
      const barH = 18;
      const passedW = Math.max(0, Math.min(barW, barW * (this.data.passedPercent / 100)));

      roundRect(ctx, barX, barY, barW, barH, barH / 2);
      ctx.fillStyle = '#e0e0e0';
      ctx.fill();
      ctx.save();
      roundRect(ctx, barX, barY, barW, barH, barH / 2);
      ctx.clip();
      const futureGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      for (let i = 0; i < 5; i++) {
        futureGradient.addColorStop(i / 4, getRandomColor());
      }
      ctx.fillStyle = futureGradient;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#111111';
      ctx.fillRect(barX, barY, passedW, barH);
      ctx.restore();

      ctx.fillStyle = '#888888';
      ctx.font = '22px sans-serif';
      ctx.fillText(`已过 ${this.data.stats.passedPercent}`, W / 2, 158);

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
            this.savePosterToAlbum(r.tempFilePath);
          }
        },
        fail: (err) => {
          console.error('[海报] canvasToTempFilePath 失败', err);
          wx.showToast({ title: '海报生成失败', icon: 'none' });
        }
      });
    });
  },

  // 保存到相册前先判断授权状态，再决定「直接保存 / 主动授权 / 引导去设置」
  savePosterToAlbum(filePath) {
    wx.getSetting({
      success: (res) => {
        const auth = res.authSetting['scope.writePhotosAlbum'];
        if (auth === false) {
          // 用户之前明确拒绝过：wx.authorize 不会再弹窗，只能引导去设置页
          this.showAlbumAuthGuide();
        } else if (auth === true) {
          this.saveImage(filePath);
        } else {
          // 从未询问过：先主动请求授权（比直接调保存 API 更可靠地弹出授权框）
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => this.saveImage(filePath),
            fail: () => this.showAlbumAuthGuide()
          });
        }
      },
      fail: () => {
        // getSetting 异常时兜底：直接尝试保存（保存 API 自身会尝试触发授权）
        this.saveImage(filePath);
      }
    });
  },

  saveImage(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => this.handleSaveFail(err)
    });
  },

  showAlbumAuthGuide() {
    wx.showModal({
      title: '需要相册权限',
      content: '保存海报需要「保存到相册」权限，请在设置中开启',
      confirmText: '去设置',
      cancelText: '取消',
      success: (r) => {
        if (r.confirm) wx.openSetting();
      }
    });
  },

  handleSaveFail(err) {
    const msg = (err && err.errMsg) || '';
    console.error('[海报] 保存失败', err);
    if (msg.indexOf('privacy') >= 0 || msg.indexOf('banned') >= 0) {
      // 线上版最常见：后台「用户隐私保护指引」未声明相册权限
      wx.showModal({
        title: '保存失败',
        content: '小程序后台的「用户隐私保护指引」未声明相册权限，请到 mp.weixin.qq.com 配置后再试',
        showCancel: false,
        confirmText: '知道了'
      });
    } else if (msg.indexOf('auth') >= 0 || msg.indexOf('authorize') >= 0 || msg.indexOf('deny') >= 0 || msg.indexOf('permission') >= 0) {
      this.showAlbumAuthGuide();
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
