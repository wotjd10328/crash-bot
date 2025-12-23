
// ULTIMATE HIGH QUALITY GRAPHICS
// [수정됨] 보안 설정(.env) 적용 버전
// =======================================

require('dotenv').config(); // 📌 require('dotenv').config(); (필수)

const {
  Client, GatewayIntentBits,
  EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  REST, Routes, SlashCommandBuilder
} = require('discord.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ===== 기본 설정 (수정됨) =====
// .env 파일에서 정보를 가져옵니다.
const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

// 토큰이 없는 경우 경고
if (!TOKEN || !ADMIN_ID) {
    console.error("❌ 오류: .env 파일을 찾을 수 없거나 TOKEN/ADMIN_ID가 비어있습니다.");
    process.exit(1);
}

// ===== 관리자 설정 값 =====
const config = {
  crashK: 0.05,       // 크래시 확률 (틱당)
  tickMs: 800,        // 갱신 속도 (너무 빠르면 디스코드 API 제한 걸림)
  step: 0.08,         // 배율 증가량
  maxMult: 100,       // 최대 배율 난수 범위
  betImage: 'https://cdn.discordapp.com/attachments/1449767362026012834/1451945904184627220/main_1.gif?ex=6949ffbf&is=6948ae3f&hm=d40f2bb4882500178123d192f3ce175a0e237452aedfa07c6e4d03a59e00ecda&' // 썸네일
};

// ===== 클라이언트 =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== 데이터 관리 =====
// 주의: 무료 호스팅(Railway, Render 등)에서는 재부팅 시 이 파일이 초기화될 수 있습니다.
const DATA_FILE = './users.json';
let users = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE)) : {};

const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
const getUser = (id) => (users[id] ??= { money: 0, lastDaily: 0, bet: 0, auto: 0 });

// ===== 게임 상태 전역 변수 =====
let game = {
  running: false,
  multiplier: 1,
  crashAt: 0,
  player: null,
  msg: null,
  timer: null,
  graphData: []
};

// ==========================================================
// [초고퀄리티] 비트코인 차트 스타일 렌더링 엔진
// ==========================================================
function drawGraph(data, crashed = false) {
  const w = 900;
  const h = 450;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // 1. 색상 팔레트 (바이낸스/트레이딩뷰 스타일)
  const colors = {
    bg: '#161A25',         // 차트 배경 (Dark Blue-Grey)
    grid: '#2B313F',       // 그리드 선
    text: '#B2B5BE',       // 일반 텍스트
    up: '#0ECB81',         // 상승 (Green)
    down: '#F6465D',       // 하락 (Red)
    upFill: 'rgba(14, 203, 129, 0.15)',
    downFill: 'rgba(246, 70, 93, 0.15)',
    white: '#FFFFFF'
  };

  const mainColor = crashed ? colors.down : colors.up;
  const fillColor = crashed ? colors.downFill : colors.upFill;

  // 2. 배경 설정
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // 3. 그리드 그리기 (가격선)
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]); // 점선 효과

  // 가로 그리드 & Y축 라벨 (가격)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '14px Arial';
  ctx.fillStyle = colors.text;

  const currentVal = data[data.length - 1];
  const maxY = Math.max(currentVal * 1.15, 2.0); // 상단 여유 15%
  
  // 5개의 가로선 그리기
  for (let i = 0; i <= 5; i++) {
    const yVal = 1 + ((maxY - 1) / 5) * i;
    const yPos = h - 30 - ((yVal - 1) / (maxY - 1)) * (h - 60);
    
    // 그리드 라인
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(w - 60, yPos); // 오른쪽 여백(축 표시 공간) 남김
    ctx.stroke();

    // 우측 가격 표시
    ctx.fillText(yVal.toFixed(2) + 'x', w - 10, yPos);
  }
  ctx.setLineDash([]); // 점선 초기화

  // 4. 데이터 좌표 계산 함수
  const totalPoints = Math.max(data.length, 30); // 최소 X축 길이
  const getX = (i) => (i / (totalPoints - 1)) * (w - 60);
  const getY = (val) => h - 30 - ((val - 1) / (maxY - 1)) * (h - 60);

  if (data.length > 0) {
    // 5. 영역 채우기 (Gradient Fill)
    const lastX = getX(data.length - 1);
    const lastY = getY(currentVal);

    ctx.beginPath();
    ctx.moveTo(0, h - 30);
    data.forEach((val, i) => ctx.lineTo(getX(i), getY(val)));
    ctx.lineTo(lastX, h - 30);
    ctx.closePath();
    
    // 그라데이션 효과
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 6. 메인 차트 라인
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = mainColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // 글로우 효과 (네온)
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 15;

    data.forEach((val, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(val));
      else ctx.lineTo(getX(i), getY(val));
    });
    ctx.stroke();
    
    // 글로우 끄기 (텍스트 등을 위해)
    ctx.shadowBlur = 0;

    // 7. 현재 가격 위치 표시 (점선 가이드 + 펄스)
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    // 가로 가이드선
    ctx.beginPath();
    ctx.moveTo(0, lastY);
    ctx.lineTo(w, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 현재 위치 점 (Pulse Dot)
    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fillStyle = colors.white;
    ctx.fill();
    
    // 점 주변 발광
    ctx.beginPath();
    ctx.arc(lastX, lastY, 12, 0, Math.PI * 2);
    ctx.fillStyle = mainColor.replace('1)', '0.3)'); // 투명도 조절
    ctx.fill();
  }

  // 8. 중앙 거대 텍스트 (HUD 스타일)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 텍스트 그림자
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 10;
  
  // 메인 숫자
  ctx.font = 'bold 90px Arial';
  ctx.fillStyle = crashed ? colors.down : colors.white; // 터지면 빨강, 아니면 흰색
  
  const displayBig = currentVal.toFixed(2) + 'x';
  ctx.fillText(displayBig, (w - 60) / 2, h / 2 - 20);

  // 상태 텍스트
  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = crashed ? colors.down : colors.up;
  const statusText = crashed ? 'CRASHED' : 'MOONING 🚀';
  ctx.fillText(statusText, (w - 60) / 2, h / 2 + 50);

  return canvas;
}

// ===== 임베드 =====
const betEmbed = (u) =>
  new EmbedBuilder()
    .setTitle('📊 CRYPTO CRASH')
    .setDescription(`현재 자산: **${u.money.toLocaleString()} KRW**\n\n차트가 떡락하기 전에 **익절(Cashout)** 하세요!`)
    .setImage(config.betImage)
    .setColor(0xF0B90B); // Binance Yellow

const gameEmbed = (text, crashed = false) =>
  new EmbedBuilder()
    .setTitle(crashed ? '📉 MARKET CRASHED' : '📈 BULL MARKET')
    .setDescription(crashed 
      ? `시장 붕괴! **${game.multiplier.toFixed(2)}x** 에서 마감되었습니다.` 
      : `현재 수익률: **${game.multiplier.toFixed(2)}x**`)
    .addFields({ name: 'STATUS', value: text, inline: true })
    .setColor(crashed ? 0xF6465D : 0x0ECB81); // Red or Green

// ===== 버튼 UI =====
const betButtons = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('bet').setLabel('금액 설정').setStyle(ButtonStyle.Secondary).setEmoji('💰'),
  new ButtonBuilder().setCustomId('auto').setLabel('자동 익절 설정').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
  new ButtonBuilder().setCustomId('start').setLabel('매수 (Start)').setStyle(ButtonStyle.Success).setEmoji('📈')
);

const cashRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('cashout').setLabel('매도 (Cashout)').setStyle(ButtonStyle.Danger).setEmoji('💸')
);

// ===== 게임 로직 =====
function startGame(channel, uid) {
  if (game.running) return;
  const u = getUser(uid);

  if (u.bet <= 0 || u.money < u.bet) return; // 에러는 상호작용에서 처리

  u.money -= u.bet; save();

  game.running = true;
  game.player = uid;
  game.multiplier = 1.00;
  // 크래시 포인트 결정 (최소 1.0배 ~ 최대 설정값)
  game.crashAt = Math.random() < 0.03 ? 1.00 : (Math.random() * config.maxMult + 1); 
  game.graphData = [1.00];

  // 초기 그래프 전송
  const canvas = drawGraph(game.graphData);
  const p = path.join(__dirname, 'chart.png');
  fs.writeFileSync(p, canvas.toBuffer());

  channel.send({ 
    embeds: [gameEmbed('매수 주문 체결 완료. 상승 시작!', false).setImage('attachment://chart.png')], 
    files: [{ attachment: p, name: 'chart.png' }],
    components: [cashRow] 
  }).then(msg => {
      game.msg = msg;
      
      // 게임 루프
      game.timer = setInterval(async () => {
        // 비선형 증가 (초반엔 느리게, 갈수록 빠르게 - 리얼함 추구)
        const growth = config.step * (1 + game.multiplier * 0.1);
        game.multiplier += growth;
        game.graphData.push(game.multiplier);

        // 자동 캐시아웃
        if (u.auto > 1 && game.multiplier >= u.auto) {
          cashout(true); return;
        }

        // 크래시 체크
        if (Math.random() < config.crashK || game.multiplier >= game.crashAt) {
          endGame('🔴 떡락 발생!', true); return;
        }

        // 그래프 업데이트
        const canvas = drawGraph(game.graphData);
        fs.writeFileSync(p, canvas.toBuffer());

        await game.msg.edit({
          embeds: [gameEmbed('가즈아! 🚀', false).setImage('attachment://chart.png')],
          files: [{ attachment: p, name: 'chart.png' }]
        });
      }, config.tickMs);
    });
}

function cashout(auto = false) {
  if (!game.running) return;
  const u = getUser(game.player);
  const win = Math.floor(u.bet * game.multiplier);
  u.money += win; save();
  endGame(auto ? `🤖 자동 매도 성공 (+${win.toLocaleString()}원)` : `💸 익절 성공! (+${win.toLocaleString()}원)`, false);
}

function endGame(text, crashed) {
  clearInterval(game.timer);
  game.running = false;

  const canvas = drawGraph(game.graphData, crashed);
  const p = path.join(__dirname, 'chart.png');
  fs.writeFileSync(p, canvas.toBuffer());

  game.msg?.edit({
    embeds: [gameEmbed(text, crashed).setImage('attachment://chart.png')],
    files: [{ attachment: p, name: 'chart.png' }],
    components: []
  });

  game.msg = null;
  game.player = null;
}

// ===== 인터랙션 핸들러 (철저한 프라이버시 보호) =====
client.on('interactionCreate', async (i) => {
  const u = getUser(i.user.id);

  // 1. 슬래시 명령어
  if (i.isChatInputCommand()) {
    const { commandName } = i;

    if (commandName === '핑') 
      return i.reply({ content: '🏓 서버 응답 속도 정상.', ephemeral: true });

    if (commandName === '잔액') 
      return i.reply({ content: `💼 현재 보유 자산: **${u.money.toLocaleString()} KRW**`, ephemeral: true });

    if (commandName === '일일') {
      if (Date.now() - u.lastDaily < 86400000)
        return i.reply({ content: '❌ 오늘은 이미 지원금을 받았습니다.', ephemeral: true });
      u.money += 10000; u.lastDaily = Date.now(); save();
      return i.reply({ content: '🎁 일일 지원금 **10,000 KRW** 지급 완료.', ephemeral: true });
    }

    if (commandName === '지급') {
      if (i.user.id !== ADMIN_ID) return i.reply({ content: '❌ 권한이 없습니다.', ephemeral: true });
      const targetUser = i.options.getUser('target');
      const amount = i.options.getNumber('amount');
      getUser(targetUser.id).money += amount; save();
      return i.reply({ content: `✅ **${targetUser.username}**님에게 **${amount} KRW** 송금 완료.`, ephemeral: true });
    }

    if (commandName === '게임') {
      return i.reply({ embeds: [betEmbed(u)], components: [betButtons], ephemeral: true });
    }

    if (commandName === '설정') {
      if (i.user.id !== ADMIN_ID) return i.reply({ content: '❌ 관리자 전용.', ephemeral: true });
      const e = new EmbedBuilder().setTitle('⚙ 시스템 설정').setDescription('게임 밸런스 조정');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_crash').setLabel('크래시 확률').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg_speed').setLabel('속도(ms)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg_step').setLabel('기본 증가량').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg_image').setLabel('이미지 URL').setStyle(ButtonStyle.Success)
      );
      return i.reply({ embeds: [e], components: [row], ephemeral: true });
    }
  }

  // 2. 버튼 처리
  if (i.isButton()) {
    if (i.customId === 'start') {
      if (game.running) return i.reply({ content: '⚠️ 현재 진행 중인 라운드가 있습니다.', ephemeral: true });
      if (u.bet <= 0) return i.reply({ content: '⚠️ 베팅 금액을 설정해주세요.', ephemeral: true });
      if (u.money < u.bet) return i.reply({ content: '⚠️ 잔액이 부족합니다.', ephemeral: true });

      await i.reply({ content: '✅ 주문이 접수되었습니다. 차트를 확인하세요.', ephemeral: true });
      startGame(i.channel, i.user.id);
      return;
    }

    if (i.customId === 'cashout') {
      if (i.user.id !== game.player) return i.reply({ content: '❌ 본인의 게임이 아닙니다.', ephemeral: true });
      cashout();
      return i.reply({ content: '✅ 익절 주문 처리됨.', ephemeral: true });
    }

    if (['bet', 'auto', 'cfg_crash', 'cfg_speed', 'cfg_step', 'cfg_image'].includes(i.customId)) {
      const titles = { bet: '베팅 금액 설정', auto: '자동 익절 배율 (해제: 0)' };
      const modal = new ModalBuilder()
        .setCustomId(i.customId)
        .setTitle(titles[i.customId] || '설정값 입력')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('value').setLabel('값').setStyle(TextInputStyle.Short)
        ));
      return i.showModal(modal);
    }
  }

  // 3. 모달 처리
  if (i.isModalSubmit()) {
    const v = i.fields.getTextInputValue('value');
    if (i.customId === 'bet') {
      const val = parseInt(v);
      if (isNaN(val) || val < 0) return i.reply({ content: '❌ 유효한 숫자가 아닙니다.', ephemeral: true });
      getUser(i.user.id).bet = val;
    }
    else if (i.customId === 'auto') getUser(i.user.id).auto = Number(v);
    else if (i.customId === 'cfg_crash') config.crashK = Number(v);
    else if (i.customId === 'cfg_speed') config.tickMs = Number(v);
    else if (i.customId === 'cfg_step') config.step = Number(v);
    else if (i.customId === 'cfg_image') config.betImage = v;

    save();
    return i.reply({ content: '✅ 설정이 저장되었습니다.', ephemeral: true });
  }
});

// ===== 봇 구동 =====
client.once('ready', async () => {
  console.log('✅ Bitcoin Crash Bot ONLINE');
  const commands = [
    new SlashCommandBuilder().setName('핑').setDescription('서버 상태 확인'),
    new SlashCommandBuilder().setName('잔액').setDescription('내 지갑 잔액 확인'),
    new SlashCommandBuilder().setName('일일').setDescription('일일 지원금 수령'),
    new SlashCommandBuilder().setName('게임').setDescription('트레이딩 시작하기'),
    new SlashCommandBuilder().setName('지급').setDescription('(관리자) 유저 송금')
      .addUserOption(o => o.setName('target').setDescription('대상').setRequired(true))
      .addNumberOption(o => o.setName('amount').setDescription('금액').setRequired(true)),
    new SlashCommandBuilder().setName('설정').setDescription('(관리자) 시스템 설정'),
  ];
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 명령어 동기화 중...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ 명령어 동기화 완료');
  } catch (e) { console.error(e); }
});

client.login(TOKEN);