/**
 * 4D Oracle - Digital Temple
 * Kau Chim (求签) fortune sticks + Dream Number Dictionary (解梦).
 * All numbers are derived deterministically (same ask, same day -> same number)
 * and every number has the identical 1-in-10,000 chance. Ritual, not prediction.
 */

const Temple = (() => {
  'use strict';

  const results = HISTORICAL_RESULTS;

  // ── Deterministic derivation ──
  // FNV-1a hash: stable across sessions so the temple "remembers" its answer.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const num4 = (seed) => String(hash(seed) % 10000).padStart(4, '0');

  const todaySG = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });

  // ── Strike history index (built once) ──
  let numberIndex = null;
  function buildIndex() {
    numberIndex = new Map();
    results.forEach((r, i) => {
      const all = [r.first, r.second, r.third, ...(r.starters || []), ...(r.consolation || [])];
      all.forEach(n => {
        if (!n) return;
        const e = numberIndex.get(n);
        if (e) { e.count++; }
        else { numberIndex.set(n, { count: 1, lastSeen: i, date: r.date }); }
      });
    });
  }

  function numberInfo(num) {
    if (!numberIndex) buildIndex();
    const e = numberIndex.get(num);
    if (!e) return { count: 0, text: 'never struck — a fresh number' };
    const ago = e.lastSeen === 0 ? 'last draw' : `${e.lastSeen} draws ago`;
    return { count: e.count, text: `struck ${e.count}× in history · last seen ${ago}` };
  }

  // ── Number checker ──
  // 4D convention: a plate/phone becomes its last 4 digits, short numbers
  // pad with leading zeros (plate 123 -> 0123).
  function normalizeNumber(raw) {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    return digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0');
  }

  function prizeOf(r, num) {
    if (r.first === num) return '1st Prize';
    if (r.second === num) return '2nd Prize';
    if (r.third === num) return '3rd Prize';
    if ((r.starters || []).includes(num)) return 'Starter';
    if ((r.consolation || []).includes(num)) return 'Consolation';
    return null;
  }

  function numberDetail(num) {
    const strikes = [];
    const byPrize = {};
    results.forEach(r => {
      const p = prizeOf(r, num);
      if (p) {
        strikes.push({ drawNo: r.drawNo, date: r.date, prize: p });
        byPrize[p] = (byPrize[p] || 0) + 1;
      }
    });
    return { strikes, byPrize, latestPrize: prizeOf(results[0], num) };
  }

  // WhatsApp carries text + link (an image cannot ride a wa.me link);
  // the image itself still reaches WhatsApp via the native share sheet.
  function shareWhatsApp(lines) {
    const text = lines.filter(Boolean).join('\n') + '\n\nhttps://cai-shen-yeah.vercel.app';
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  // ── Blessing card (canvas share) ──
  // Each card is painted over one of the lore backgrounds in /cards,
  // chosen at random, so no two shares look alike.
  const CARD_BGS = 8;

  function shareCard(title, subtitle, number, note) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    const paintForeground = () => {
      const glow = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 700);
      glow.addColorStop(0, 'rgba(212,175,55,0.14)');
      glow.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#a88a2a';
      ctx.lineWidth = 6;
      ctx.strokeRect(40, 40, W - 80, H - 80);
      ctx.strokeStyle = 'rgba(212,175,55,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(58, 58, W - 116, H - 116);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#d4af37';
      ctx.font = '52px Georgia, serif';
      ctx.fillText('🏮 CaiShenYeah 财神爷', W / 2, 190);
      ctx.fillStyle = '#c8c8c8';
      ctx.font = '32px Georgia, serif';
      ctx.fillText('The Digital Temple of Fortune', W / 2, 245);

      ctx.fillStyle = '#f0d060';
      ctx.font = 'bold 110px Georgia, serif';
      ctx.fillText(title, W / 2, 480);
      ctx.fillStyle = '#ffffff';
      ctx.font = '40px Georgia, serif';
      ctx.fillText(subtitle, W / 2, 560);

      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 185px "Courier New", monospace';
      ctx.fillText(number.split('').join(' '), W / 2, 830);

      ctx.fillStyle = '#c8c8c8';
      ctx.font = '34px Georgia, serif';
      ctx.fillText(note, W / 2, 930);
      ctx.fillText(new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }), W / 2, 1150);
      ctx.fillStyle = '#8a8a8a';
      ctx.font = '28px Georgia, serif';
      ctx.fillText('Every number has the same 1-in-10,000 chance · Play responsibly', W / 2, 1230);

      c.toBlob(async (blob) => {
        const file = new File([blob], 'caishenyeah-blessing.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'CaiShenYeah Blessing' }); return; } catch (e) { /* cancelled */ }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'caishenyeah-blessing.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      });
    };

    // Base coat, so a failed background still yields the classic dark card
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const img = new Image();
    const pick = 1 + Math.floor(Math.random() * CARD_BGS);
    img.onload = () => {
      const s = Math.max(W / img.width, H / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // Veil for legibility: gentle overall dim, deeper behind the text column
      ctx.fillStyle = 'rgba(8,8,8,0.38)';
      ctx.fillRect(0, 0, W, H);
      const veil = ctx.createRadialGradient(W / 2, H * 0.52, 120, W / 2, H * 0.52, 720);
      veil.addColorStop(0, 'rgba(8,8,8,0.5)');
      veil.addColorStop(1, 'rgba(8,8,8,0)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, H);
      paintForeground();
    };
    img.onerror = paintForeground;
    img.src = `cards/bg-${pick}.jpg`;
  }

  // ── Kau Chim fortunes ──
  const FORTUNE_LEVELS = {
    great: { label: '上上 Great Blessing', cls: 'level-great' },
    good: { label: '上吉 Good Fortune', cls: 'level-good' },
    fair: { label: '中吉 Fair Fortune', cls: 'level-fair' },
    neutral: { label: '中平 Neutral', cls: 'level-neutral' },
    caution: { label: '下签 Proceed Gently', cls: 'level-caution' }
  };

  const FORTUNES = [
    { n: 1, level: 'great', title: '姜太公封相', en: 'Jiang Ziya Made Chancellor',
      story: 'For eighty years he fished with a straight hook, asking nothing - then King Wen came to the river and made him chancellor of Zhou.',
      verse: 'The straight hook catches no fish, yet lands a kingdom; what heaven has delayed, heaven has been ripening.',
      advice: 'Your long patience is about to be repaid in full. Do not shrink from the size of what arrives.' },
    { n: 2, level: 'neutral', title: '庄周梦蝶', en: 'Zhuangzi Dreams of the Butterfly',
      story: 'Zhuangzi dreamt he was a butterfly, and woke unsure which of the two he truly was.',
      verse: 'Wings or robes, dream or waking - the lake holds the same moon either way.',
      advice: 'Do not force the answer today. Sit with the question; it is doing its work.' },
    { n: 3, level: 'good', title: '文王访贤', en: 'King Wen Seeks the Sage',
      story: 'A king left his palace to seek a fisherman\'s counsel, and gained the minister who built a dynasty.',
      verse: 'When the worthy are sought out, doors open from the far side; humility travels further than command.',
      advice: 'Go to the person yourself. The asking is the winning.' },
    { n: 4, level: 'neutral', title: '宁戚饭牛', en: 'Ning Qi Feeds the Oxen',
      story: 'Ning Qi sang while feeding oxen at the city gate; Duke Huan heard the song and raised him to office.',
      verse: 'Tend your oxen well and sing while you do it - the right ears pass by when least expected.',
      advice: 'Keep doing honest work in plain sight. Someone is listening.' },
    { n: 5, level: 'fair', title: '刘晨遇仙', en: 'Liu Chen Meets the Immortals',
      story: 'Gathering herbs on Tiantai mountain, Liu Chen wandered into a hidden valley and was received by immortals.',
      verse: 'Lost among the peaks, he found a gate no map records; some detours are invitations.',
      advice: 'The wrong turn you took may be the road itself. Follow it a little further.' },
    { n: 6, level: 'neutral', title: '踏雪寻梅', en: 'Walking in Snow, Seeking Plum Blossom',
      story: 'The poet Meng Haoran went out into the snow searching for plum blossoms, finding poetry in the cold itself.',
      verse: 'He went seeking blossoms and returned with winter in his sleeves - both are worth carrying home.',
      advice: 'Enjoy the search without demanding the find. The season is the gift.' },
    { n: 7, level: 'fair', title: '高山流水', en: 'High Mountains, Flowing Water',
      story: 'Boya played the qin; only Ziqi truly heard it. When Ziqi died, Boya broke his strings forever.',
      verse: 'One listener who understands outweighs a hall of applause.',
      advice: 'Invest in the few who truly hear you. They are your fortune.' },
    { n: 8, level: 'neutral', title: '塞翁失马', en: 'The Old Man Loses His Horse',
      story: 'The frontier man\'s horse ran off - then returned leading another. His son broke a leg - and was spared the war.',
      verse: 'Loss walks in wearing gain\'s clothing, and gain in loss\'s; wait three turns before you name either.',
      advice: 'Do not celebrate or grieve today\'s news too quickly. Its meaning is still changing.' },
    { n: 9, level: 'fair', title: '孟母三迁', en: 'The Thrice-Moved Household',
      story: 'Three times Mencius\' mother moved house until her son had neighbours worth imitating - and he became a sage.',
      verse: 'Soil decides what the seed becomes; choose the ground before you blame the plant.',
      advice: 'Change your surroundings, not your nature. Environment is doing more than you think.' },
    { n: 10, level: 'neutral', title: '渔樵问答', en: 'The Fisherman and the Woodcutter',
      story: 'On the river bank a fisherman and a woodcutter traded questions about kingdoms, and laughed, and let the current pass.',
      verse: 'Dynasties rise and fall between two casts of the net; the river keeps none of it.',
      advice: 'Step back from the urgent matter. From the bank, it is smaller than it looks.' },
    { n: 11, level: 'neutral', title: '太白问月', en: 'Li Bai Questions the Moon',
      story: 'Li Bai raised his cup and asked the moon questions that needed no answer, three shadows drinking together.',
      verse: 'The moon answers no questions and never disappoints; some company asks nothing of you.',
      advice: 'Take an evening for yourself. Restoration is also progress.' },
    { n: 12, level: 'good', title: '圯桥进履', en: 'The Shoe on the Bridge',
      story: 'An old man dropped his shoe below a bridge and told Zhang Liang to fetch it. His patience earned him the art of war.',
      verse: 'Stoop to lift the old man\'s shoe and rise holding a general\'s book; small humiliations carry sealed gifts.',
      advice: 'Swallow the small indignity in front of you. It is a test with a prize.' },
    { n: 13, level: 'neutral', title: '采菊东篱', en: 'Chrysanthemums at the Eastern Fence',
      story: 'Tao Yuanming left office for his farm, picking chrysanthemums beneath the southern mountain.',
      verse: 'Rank surrendered, fence and flowers gained - he grew richer by wanting less.',
      advice: 'Simplify. What you release this week will pay you back in peace.' },
    { n: 14, level: 'fair', title: '木兰从军', en: 'Mulan Joins the Army',
      story: 'Mulan took her father\'s place in the army, served twelve years, and came home with honours nobody could have predicted.',
      verse: 'Duty worn quietly becomes armour; the household\'s burden became the empire\'s legend.',
      advice: 'Take up the responsibility no one else can. It will remake you.' },
    { n: 15, level: 'neutral', title: '月老系绳', en: 'The Old Man Under the Moon',
      story: 'The matchmaker beneath the moon ties invisible red threads between those destined to meet.',
      verse: 'The thread is tied already and pulls in its own season; tugging does not hurry it.',
      advice: 'In matters of the heart, prepare yourself and be patient. The thread holds.' },
    { n: 16, level: 'caution', title: '守株待兔', en: 'Waiting by the Stump',
      story: 'A farmer saw a rabbit break its neck on a stump, and gave up ploughing to wait for the next one.',
      verse: 'One windfall is weather, not a harvest; the field abandoned grows only regret.',
      advice: 'Yesterday\'s luck is not a strategy. Return to the plough.' },
    { n: 17, level: 'fair', title: '毛遂自荐', en: 'Mao Sui Recommends Himself',
      story: 'Unnoticed for three years, Mao Sui put himself forward for the mission to Chu - and carried the day.',
      verse: 'The awl in the bag must first be placed in the bag; step forward or stay unseen.',
      advice: 'Volunteer. Nobody will nominate you for the thing you were made for.' },
    { n: 18, level: 'caution', title: '纸上谈兵', en: 'War on Paper',
      story: 'Zhao Kuo knew every book of strategy and lost four hundred thousand men in his first real battle.',
      verse: 'The map is flat and the mountain is not; theory unbled is a dangerous teacher.',
      advice: 'Test it small before you bet it all. Experience over eloquence.' },
    { n: 19, level: 'fair', title: '伏羲画卦', en: 'Fuxi Draws the Trigrams',
      story: 'Watching heaven\'s patterns and the markings of birds and beasts, Fuxi drew the eight trigrams and gave chaos a grammar.',
      verse: 'He read the world before he wrote it; order copied from nature endures.',
      advice: 'Study the pattern before you act on it. The data is already speaking.' },
    { n: 20, level: 'neutral', title: '麻姑献寿', en: 'Magu Offers Longevity',
      story: 'The immortal maiden Magu, who has three times seen the sea become mulberry fields, brings wine for a birthday.',
      verse: 'She has watched oceans turn to orchards - your urgent decade is her afternoon.',
      advice: 'Think in years, not weeks. Health and patience compound.' },
    { n: 21, level: 'good', title: '李旦龙凤配', en: 'The Dragon and Phoenix Match',
      story: 'The exiled prince Li Dan, hidden among commoners, found the marriage that restored him to his destiny.',
      verse: 'In the plainest courtyard the phoenix found her dragon; right pairing outranks right timing.',
      advice: 'A partnership formed now carries further than it appears. Choose well and commit.' },
    { n: 22, level: 'neutral', title: '东坡游赤壁', en: 'Su Dongpo Drifts at Red Cliff',
      story: 'Banished and poor, Su Dongpo boated beneath Red Cliff and wrote the essays that outlived every minister who exiled him.',
      verse: 'The demotion wrote the masterpiece; the river he was banished to became his page.',
      advice: 'Make something within today\'s limits. Constraint is a strange patron.' },
    { n: 23, level: 'caution', title: '夸父逐日', en: 'Kuafu Chases the Sun',
      story: 'The giant Kuafu raced the sun itself, drank two rivers dry, and died of thirst still running.',
      verse: 'He outran everything except his own want; the sun set exactly as it always does.',
      advice: 'Name the finish line before you run. Some pursuits consume the pursuer.' },
    { n: 24, level: 'fair', title: '大禹治水', en: 'Yu Tames the Waters',
      story: 'Where his father built dams that burst, Yu cut channels - passing his own door three times without entering, until the floods obeyed.',
      verse: 'Water refuses walls and accepts invitations; guide what you cannot block.',
      advice: 'Stop damming the problem. Redirect it.' },
    { n: 25, level: 'neutral', title: '竹林七贤', en: 'Seven Sages of the Bamboo Grove',
      story: 'Seven scholars withdrew to a bamboo grove with wine and qin, keeping their integrity while the court decayed.',
      verse: 'When the hall is crooked, the grove is the office; keep your circle and your tuning.',
      advice: 'Guard your small circle of honest friends this month. That is the real network.' },
    { n: 26, level: 'fair', title: '钟馗得道', en: 'Zhong Kui Attains His Post',
      story: 'Rejected for his fearsome face despite ranking first, Zhong Kui became in death the queller of demons - honoured ever since.',
      verse: 'The gate that shut on his face opened onto a larger doorway; rejection re-addressed the letter.',
      advice: 'The rejection was redirection. The bigger role is behind it.' },
    { n: 27, level: 'caution', title: '霸王被困', en: 'Xiang Yu Surrounded at Jiuli',
      story: 'The strongest general of his age, encircled at Gaixia, heard Chu songs on every side and would not cross the river home.',
      verse: 'Strength that cannot bend gets folded; even now a boat waits at the bank he refuses.',
      advice: 'Retreat is open and honourable. Take it while it is offered.' },
    { n: 28, level: 'fair', title: '田忌赛马', en: 'Tian Ji Races His Horses',
      story: 'Advised by Sun Bin, Tian Ji ran his worst horse against the king\'s best - and won the set two races to one.',
      verse: 'Lose the race you cannot win to take the two you can; arrangement beats strength.',
      advice: 'Reorder your efforts. Sacrifice one front deliberately and win the campaign.' },
    { n: 29, level: 'neutral', title: '兰亭雅集', en: 'Gathering at the Orchid Pavilion',
      story: 'Wang Xizhi and friends floated wine cups down a winding stream, and the preface he wrote that day became immortal.',
      verse: 'An afternoon among friends, brushed casually, outlasted the dynasties; joy recorded is joy kept.',
      advice: 'Gather your people. Something made lightly now will matter later.' },
    { n: 30, level: 'good', title: '萧何追韩信', en: 'Chasing Han Xin by Moonlight',
      story: 'When the unrecognised Han Xin deserted, Xiao He rode through the night to bring him back - and gave the dynasty its general.',
      verse: 'Ride now, explain later - talent walking away does not wait for morning.',
      advice: 'Act tonight on the person or chance about to slip away.' },
    { n: 31, level: 'fair', title: '三顾茅庐', en: 'Three Visits to the Thatched Hut',
      story: 'Liu Bei called three times at Zhuge Liang\'s hut, standing in snow, until the strategist consented to serve.',
      verse: 'Twice refused is not refused; the third knock opens what the first could not.',
      advice: 'Ask again. Persistence with courtesy is a key that fits most doors.' },
    { n: 32, level: 'neutral', title: '和合二仙', en: 'The Two Immortals of Harmony',
      story: 'The immortal pair Hehe - one holding a lotus, one a round box - bless unions and mended quarrels.',
      verse: 'A lotus and a box: one opens, one holds; every bond needs both.',
      advice: 'Mend the small rift now, while it is still small.' },
    { n: 33, level: 'neutral', title: '老子出关', en: 'Laozi Passes the Western Gate',
      story: 'Leaving the declining Zhou, Laozi was stopped at the pass and asked to write down his wisdom - five thousand words, then gone.',
      verse: 'He left quietly and his leaving became the teaching; exits, done well, are gifts.',
      advice: 'If it is time to leave something, leave it cleanly and generously.' },
    { n: 34, level: 'fair', title: '桃园结义', en: 'The Peach Garden Oath',
      story: 'Liu Bei, Guan Yu and Zhang Fei swore brotherhood among the peach blossoms - not born together, but choosing one loyalty.',
      verse: 'Three cups among the blossoms outlasted armies; chosen bonds are the strongest architecture.',
      advice: 'Formalize the alliance. Shake hands and mean it.' },
    { n: 35, level: 'fair', title: '唐僧取经', en: 'The Pilgrimage West',
      story: 'Through eighty-one ordeals Tang Sanzang walked west for the scriptures, each disaster another step of the journey itself.',
      verse: 'The obstacles were not on the road - they were the road; he arrived made of them.',
      advice: 'The current difficulty is part of the syllabus, not a deviation. Continue.' },
    { n: 36, level: 'good', title: '风送滕王阁', en: 'The Wind Carries Wang Bo',
      story: 'A favourable wind carried young Wang Bo overnight to the Tengwang Pavilion banquet, where his impromptu preface stunned the hall.',
      verse: 'The borrowed wind arrives for the prepared sail; he wrote in an evening what talent had readied for years.',
      advice: 'Say yes to the sudden invitation. You are more ready than you feel.' },
    { n: 37, level: 'neutral', title: '梅妻鹤子', en: 'Plum Wife, Crane Sons',
      story: 'The hermit Lin Bu never married, tending plum trees and cranes by West Lake, wanting nothing the capital offered.',
      verse: 'He counted blossoms instead of coins and died the richer accountant.',
      advice: 'Measure this month by what delights you, not what impresses others.' },
    { n: 38, level: 'caution', title: '刻舟求剑', en: 'Notching the Boat',
      story: 'His sword fell overboard, so he notched the moving boat where it dropped - and dived at the notch when the boat had sailed on.',
      verse: 'The mark stayed; the river did not. Yesterday\'s coordinates locate nothing.',
      advice: 'Your situation has moved. Update the plan, not the memory of it.' },
    { n: 39, level: 'neutral', title: '寒山拾得', en: 'Hanshan and Shide',
      story: 'Asked how to deal with those who slander and cheat us, Shide said: bear them, let them be, and in a few years, go and look at them.',
      verse: 'Endure, yield, ignore - and revisit in five autumns; time is the cheapest lawyer.',
      advice: 'Do not answer the provocation. Let time argue for you.' },
    { n: 40, level: 'fair', title: '愚公移山', en: 'The Old Man Moves the Mountains',
      story: 'Yugong began digging away the mountains before his door; heaven, moved by generations of resolve, carried them off.',
      verse: 'Bucket by bucket is a slow arithmetic that heaven eventually rounds up.',
      advice: 'Keep the daily effort. The breakthrough is watching.' },
    { n: 41, level: 'neutral', title: '白云苍狗', en: 'White Clouds, Grey Dogs',
      story: 'Du Fu watched clouds change from white robes to grey dogs, and named how fortunes shift shapes.',
      verse: 'The sky redraws itself hourly and apologises to no one.',
      advice: 'Hold your plans loosely this week. Adjust rather than resist.' },
    { n: 42, level: 'caution', title: '杯弓蛇影', en: 'The Bow in the Wine Cup',
      story: 'A guest fell ill after seeing a snake in his wine - it was a bow\'s reflection. Told the truth, he recovered at once.',
      verse: 'The snake was a shadow and the sickness was real; fear invoices the body.',
      advice: 'The threat is smaller than the dread. Verify before you suffer.' },
    { n: 43, level: 'neutral', title: '对牛弹琴', en: 'Playing the Qin to an Ox',
      story: 'Gongming Yi played fine music to a grazing ox, which went on grazing - the fault lay in the audience chosen.',
      verse: 'The song was flawless and the ox unmoved; eloquence needs address as much as art.',
      advice: 'Change the audience, not the message. Pitch where ears are.' },
    { n: 44, level: 'fair', title: '严陵归钓', en: 'Yan Ziling Returns to Fishing',
      story: 'Offered high office by the emperor who was once his classmate, Yan Ziling chose his fishing terrace on the Fuchun river.',
      verse: 'He declined the palace and kept the river; some refusals are promotions.',
      advice: 'You may decline the shiny thing. Protecting your way of life is a valid win.' },
    { n: 45, level: 'neutral', title: '井底之蛙', en: 'The Frog at the Bottom of the Well',
      story: 'The frog boasted of his well until a sea turtle described the ocean, and the well went quiet.',
      verse: 'His sky was a coin until the turtle spoke; the well was never the world.',
      advice: 'Seek a bigger conversation this month. Your ceiling is a lid, not the sky.' },
    { n: 46, level: 'fair', title: '卧薪尝胆', en: 'Sleeping on Firewood, Tasting Gall',
      story: 'Defeated Goujian slept on brushwood and tasted gall daily for years, until Yue rose and overturned Wu.',
      verse: 'He salted his comfort so memory stayed sharp; ten patient years moved the verdict.',
      advice: 'Endure strategically. Keep the goal bitter-fresh and build quietly.' },
    { n: 47, level: 'great', title: '梁灏登科', en: 'Liang Hao Takes the Highest Degree',
      story: 'Legend says Liang Hao kept sitting the imperial examination until he took first place at eighty-two, unbowed by decades without his name on the list.',
      verse: 'Eighty-two springs to open one door - and the door, opening, made every winter part of the triumph.',
      advice: 'It is not too late. It was never too late. Sit the exam again.' },
    { n: 48, level: 'caution', title: '败走麦城', en: 'Guan Yu Retreats to Maicheng',
      story: 'Proudest of generals, Guan Yu scorned alliance, lost Jingzhou to a flank he dismissed, and fell retreating at Maicheng.',
      verse: 'The blade that never doubted was undone by the ally it insulted; pride leaves flanks open.',
      advice: 'Repair the alliance you have been too proud to need. Now.' },
    { n: 49, level: 'neutral', title: '程门立雪', en: 'Standing in Snow at the Gate',
      story: 'Yang Shi stood unmoving in falling snow rather than wake his dozing teacher, and the snow reached a foot deep.',
      verse: 'The deepest bow is made of patience; snow measured his respect in inches.',
      advice: 'Honour your teachers and sources. Deference now purchases depth later.' },
    { n: 50, level: 'good', title: '陶朱归湖', en: 'Fan Li Sails the Five Lakes',
      story: 'Having restored the kingdom of Yue, Fan Li declined every honour, sailed the five lakes, and thrice made and gave away fortunes as Lord Taozhu.',
      verse: 'He left at the applause, not after it, and wealth followed the man who kept walking away from it.',
      advice: 'Exit at the peak. Take profits, give generously, begin again lighter.' },
    { n: 51, level: 'neutral', title: '孔子问礼', en: 'Confucius Asks About Ritual',
      story: 'Confucius himself travelled to consult Laozi, proof that the great remain students first.',
      verse: 'The sage crossed provinces to ask a question; certainty is the amateur\'s luxury.',
      advice: 'Ask the expert. The question costs a moment; the ignorance costs a season.' },
    { n: 52, level: 'neutral', title: '貂蝉拜月', en: 'Diaochan Prays to the Moon',
      story: 'Diaochan\'s beauty made the moon hide behind clouds - and her quiet courage unseated a tyrant.',
      verse: 'Softness, aimed well, moved what armies could not.',
      advice: 'Influence beats force this week. Work through grace, not pressure.' },
    { n: 53, level: 'fair', title: '刘备招亲', en: 'Liu Bei Comes for the Bride',
      story: 'Lured to Wu by a false marriage plot, Liu Bei walked into the trap - and walked out with a real wife and alliance.',
      verse: 'He entered a snare and left with a family; sincerity converts even ambushes.',
      advice: 'Enter the risky meeting in good faith. Genuineness flips traps.' },
    { n: 54, level: 'neutral', title: '浴沂咏归', en: 'Bathing in the Yi, Singing Home',
      story: 'Asked his ambition, Zeng Dian wished only to bathe in the Yi river with friends and return home singing - and the Master sighed in agreement.',
      verse: 'Among grand ambitions, the truest answer was an afternoon by the river.',
      advice: 'Your modest wish is legitimate. Build the life, not the resume.' },
    { n: 55, level: 'fair', title: '完璧归赵', en: 'The Jade Returned Intact',
      story: 'Lin Xiangru carried the priceless jade into the Qin court, matched the king\'s bad faith with nerve, and brought it home whole.',
      verse: 'He walked into the lion\'s hall holding the treasure and walked out still holding it; composure is armour.',
      advice: 'Hold your terms in the hard negotiation. Do not blink first.' },
    { n: 56, level: 'caution', title: '东施效颦', en: 'Dongshi Imitates the Frown',
      story: 'Plain Dongshi copied the famous beauty\'s pained frown, and the whole village bolted its doors.',
      verse: 'The frown was never the beauty; copied surfaces advertise the missing substance.',
      advice: 'Stop imitating the market leader. Their symptom is not your strategy.' },
    { n: 57, level: 'neutral', title: '断机教子', en: 'Cutting the Cloth on the Loom',
      story: 'When young Mencius quit his studies, his mother cut through her half-woven cloth: abandoned learning is this ruined weave.',
      verse: 'The shuttle stopped mid-cloth teaches louder than lectures; unfinished is its own waste.',
      advice: 'Finish what you started before starting anything new.' },
    { n: 58, level: 'fair', title: '苏秦刺股', en: 'Su Qin and the Awl',
      story: 'Mocked and penniless after failing every court, Su Qin studied nights with an awl at his thigh - and later wore the seals of six states.',
      verse: 'The awl kept the scholar awake and the scorn kept him honest; six chancellorships grew from one humiliation.',
      advice: 'Convert the insult into study hours. Let them regret their laughter.' },
    { n: 59, level: 'neutral', title: '岁寒三友', en: 'Three Friends of Winter',
      story: 'Pine, bamboo and plum stay green and bloom in the cold season, when every showier plant has gone.',
      verse: 'Winter is the honest auditor of friendships and portfolios alike.',
      advice: 'Note who and what holds up in this lean stretch. Keep those.' },
    { n: 60, level: 'caution', title: '拔苗助长', en: 'Pulling Up the Seedlings',
      story: 'Impatient for his rice to grow, the farmer tugged each seedling taller - and by evening the field lay wilted.',
      verse: 'He helped every stalk to death by lunchtime; growth forced is growth forfeited.',
      advice: 'Stop accelerating it. The thing is growing at its own correct speed.' },
    { n: 61, level: 'good', title: '汾阳祝寿', en: 'Guo Ziyi\'s Birthday Feast',
      story: 'General Guo Ziyi, saviour of the Tang, lived past eighty with seven sons and eight sons-in-law at court, honoured by four emperors.',
      verse: 'Merit worn humbly survived four reigns; his table grew longer every winter.',
      advice: 'Build for the long feast: reputation, family, allies. All three compound.' },
    { n: 62, level: 'neutral', title: '邵雍观梅', en: 'Shao Yong Watches the Plum Tree',
      story: 'The philosopher read coming events in two sparrows quarrelling on a plum branch, unhurried and exact.',
      verse: 'He watched the small signs others stepped past; the future prefers careful readers.',
      advice: 'Slow down and observe before deciding. The signal is in the small data.' },
    { n: 63, level: 'caution', title: '荆轲刺秦', en: 'Jing Ke Crosses the Cold River',
      story: 'The map unrolled, the dagger flashed, and history held its breath - but the plan had one thrust and no second.',
      verse: 'Cold river, brave song, single chance: heroics without a second path is theatre.',
      advice: 'Do not bet everything on one attempt. Build a fallback before you act.' },
    { n: 64, level: 'neutral', title: '杞人忧天', en: 'The Man of Qi Fears the Sky',
      story: 'A man of Qi could not eat or sleep for fear the sky would fall, until a friend walked him through why it would not.',
      verse: 'He rehearsed a catastrophe that never auditioned; worry is imagination misassigned.',
      advice: 'Write the fear down and interrogate it. Most of it resigns on paper.' },
    { n: 65, level: 'fair', title: '董永遇仙', en: 'Dong Yong Meets the Weaver Maid',
      story: 'Dong Yong sold himself into service to bury his father; the Weaver Maid, moved, came down and wove a hundred bolts to free him.',
      verse: 'Filial devotion priced at bondage was refunded by heaven with interest.',
      advice: 'Do the costly right thing. Help is already moving toward it.' },
    { n: 66, level: 'neutral', title: '中流击楫', en: 'Striking the Oar Midstream',
      story: 'Crossing the Yangtze, Zu Ti struck the oar and vowed not to recross until the north was restored - and his army believed him.',
      verse: 'One oath at midriver set a fleet\'s spine straight.',
      advice: 'Declare the commitment out loud. Public resolve recruits.' },
    { n: 67, level: 'neutral', title: '陶朱遣子', en: 'The Ransom Miscarried',
      story: 'Lord Taozhu sent his frugal eldest, not his free-spending youngest, to ransom a son - and frugality botched the errand.',
      verse: 'He sent the saver to do a spender\'s errand; the right person differs by task.',
      advice: 'Match the person to the task\'s temperament, not to seniority.' },
    { n: 68, level: 'fair', title: '闻鸡起舞', en: 'Rising at Cockcrow to Practise',
      story: 'Zu Ti and Liu Kun woke each other at every rooster\'s cry to drill with swords in the dark courtyard.',
      verse: 'They fenced with the dawn until the dawn took sides.',
      advice: 'Claim the early hour. The edge is won before breakfast.' },
    { n: 69, level: 'caution', title: '石崇斗富', en: 'Shi Chong\'s Contest of Wealth',
      story: 'Shi Chong smashed coral trees to outshine a rival in extravagance; his gold later summoned his executioners.',
      verse: 'He won every round of the spending contest, including the last one, which was fatal.',
      advice: 'Do not compete on display. Visible wealth invites invisible costs.' },
    { n: 70, level: 'neutral', title: '贾人渡河', en: 'The Scholar and the Ferryman',
      story: 'A ferryman was mocked for knowing only water; midstream the boat leaked, and only one skill on board mattered.',
      verse: 'Ten classics will not bail a boat; this hour has its own required subject.',
      advice: 'Learn the practical skill the situation demands. Prestige can wait.' },
    { n: 71, level: 'good', title: '苏武还朝', en: 'Su Wu Returns to the Court',
      story: 'Nineteen years herding sheep in the northern snows, refusing every inducement, Su Wu kept his tattered envoy\'s staff - and came home an immortal name.',
      verse: 'The staff lost its banners but never its meaning; loyalty outlasted the empire that tested it.',
      advice: 'Keep faith with your commitments through this long stretch. The return is coming.' },
    { n: 72, level: 'fair', title: '张骞通西域', en: 'Zhang Qian Opens the West',
      story: 'Captured for ten years on his first mission, Zhang Qian escaped, kept going west, and opened the roads that became the Silk Road.',
      verse: 'Detained a decade, he still delivered the map; the detours annotated it.',
      advice: 'The delay has been gathering intelligence. Resume the mission with what it taught you.' },
    { n: 73, level: 'caution', title: '街亭失守', en: 'Ma Su Loses Jieting',
      story: 'Clever Ma Su ignored his orders and camped on the waterless hill; Jieting fell, and Zhuge Liang wept as discipline took its course.',
      verse: 'The brilliant improvisation lost the campaign the boring order would have kept.',
      advice: 'Follow the agreed plan this time. Cleverness is not the assignment.' },
    { n: 74, level: 'neutral', title: '推敲', en: 'Push, or Knock',
      story: 'The poet Jia Dao, torn between two words for one line, collided with the governor\'s procession - who stopped to help him choose.',
      verse: 'Two verbs, one gate, a magistrate consulted: precision is worth the traffic accident.',
      advice: 'Sweat the wording. The small refinement is the difference.' },
    { n: 75, level: 'fair', title: '三难新郎', en: 'Su Xiaomei\'s Three Riddles',
      story: 'On her wedding night Su Xiaomei set her groom three riddles before the door would open - and made the marriage a meeting of minds.',
      verse: 'She locked the door with questions so the opening would mean something.',
      advice: 'Set standards early in the new arrangement. Good tests make good bonds.' },
    { n: 76, level: 'neutral', title: '洪武放牛', en: 'The Cowherd Who Would Be Emperor',
      story: 'Zhu Yuanzhang herded cattle and begged as an orphan monk before founding the Ming dynasty.',
      verse: 'The buffalo\'s back was a throne in rehearsal.',
      advice: 'Your current humble position is training, not verdict. Learn everything here.' },
    { n: 77, level: 'good', title: '咬金聘亲', en: 'Cheng Yaojin\'s Betrothal',
      story: 'Rough, loud and lucky, Cheng Yaojin blundered into fortune after fortune - his three axe-strokes enough for every occasion.',
      verse: 'Three moves, none elegant, all sufficient; heaven has a soft spot for the wholehearted.',
      advice: 'Move with cheerful boldness. Your simple direct approach is working.' },
    { n: 78, level: 'caution', title: '画蛇添足', en: 'Adding Feet to the Snake',
      story: 'The wine went to whoever drew a snake fastest; the winner, showing off, added feet - and lost the prize.',
      verse: 'The snake was finished and then improved to death.',
      advice: 'It is done. Stop adding. Ship it.' },
    { n: 79, level: 'neutral', title: '负米养亲', en: 'Carrying Rice a Hundred Li',
      story: 'Zilu carried rice a hundred li to feed his parents, and later, in wealth, wished he still could.',
      verse: 'The heavy sack was the light heart; he missed the burden when it ended.',
      advice: 'Do the tiring family duty gladly. You will miss even this.' },
    { n: 80, level: 'fair', title: '破缸救友', en: 'Sima Guang Breaks the Vat',
      story: 'When a child fell into the great water vat, the other children fled; young Sima Guang smashed it with a stone.',
      verse: 'The vat was precious until the child was in it; he priced them correctly at once.',
      advice: 'Act decisively. Break the expensive thing if it saves the essential one.' },
    { n: 81, level: 'neutral', title: '雪中送炭', en: 'Charcoal in the Snow',
      story: 'The emperor sent charcoal to the poor in a blizzard - remembered longer than any banquet he hosted.',
      verse: 'Warmth delivered in the storm is counted double and forgotten never.',
      advice: 'Help someone now, while they are cold. Timing is the gift.' },
    { n: 82, level: 'caution', title: '邯郸学步', en: 'Learning the Handan Walk',
      story: 'A youth went to Handan to learn its elegant walk, failed, forgot his own gait, and crawled home.',
      verse: 'He returned without the new walk or the old one.',
      advice: 'Do not abandon your native strengths mid-imitation. Return to what is yours.' },
    { n: 83, level: 'fair', title: '岳母刺字', en: 'The Four Characters on His Back',
      story: 'Yue Fei\'s mother needled four characters into his back - utmost loyalty, serve the nation - and he never once betrayed them.',
      verse: 'The vow written in skin steered every later battlefield.',
      advice: 'Write your principle down where you cannot unsee it. Then keep it.' },
    { n: 84, level: 'neutral', title: '鼓盆而歌', en: 'Drumming on a Basin',
      story: 'At his wife\'s death Zhuangzi sat drumming a basin and singing - grief transformed by seeing the change as a return.',
      verse: 'He sang the mourning he could not argue with; acceptance has its own music.',
      advice: 'Let the loss be a season, not a verdict. Grieve, and keep living.' },
    { n: 85, level: 'neutral', title: '曲高和寡', en: 'The Song Too Refined',
      story: 'The finer the singer\'s song, the fewer in the city could sing along - thousands for the folk tune, a handful for the classic.',
      verse: 'Ten thousand hummed the easy chorus; three heard the masterpiece. Both numbers are information.',
      advice: 'If few understand your best work, check the room before doubting the work.' },
    { n: 86, level: 'fair', title: '平贵回窑', en: 'Return to the Cold Kiln',
      story: 'After eighteen years at war, Xue Pinggui returned to the cold kiln where Wang Baochuan had faithfully waited.',
      verse: 'Eighteen winters kept one hearth warm enough to find.',
      advice: 'Someone\'s loyalty to you has been under-thanked. Return and honour it.' },
    { n: 87, level: 'caution', title: '掩耳盗铃', en: 'Stealing the Bell, Ears Covered',
      story: 'The thief muffled his own ears to silence the great bell he was stealing - and all the village heard it ring.',
      verse: 'Deafening himself did not deafen the town.',
      advice: 'The problem you are not mentioning is audible to everyone. Address it openly.' },
    { n: 88, level: 'great', title: '天官赐福', en: 'The Heavenly Official Bestows Blessing',
      story: 'On the fifteenth night of the first month, the Heavenly Official descends to bestow blessing - unpetitioned, unearned, abundant.',
      verse: 'The blessing arrives like the tide: unbargained, addressed to you, already on the water.',
      advice: 'Receive the good fortune without suspicion. Say thank you and share it widely.' },
    { n: 89, level: 'neutral', title: '一诺千金', en: 'A Promise Worth a Thousand Gold',
      story: 'Ji Bu never broke a promise; men said gaining his single yes outweighed a hundred pounds of gold.',
      verse: 'His word appreciated faster than bullion.',
      advice: 'Promise less, deliver utterly. Your reliability is the asset being watched.' },
    { n: 90, level: 'fair', title: '湘子得道', en: 'Han Xiangzi Attains the Way',
      story: 'Han Yu\'s nephew abandoned examinations for the flute and the Way - and made flowers bloom in winter to show what he had chosen.',
      verse: 'He failed the exams and passed the immortals\'; there is more than one ladder.',
      advice: 'The unconventional path you are drawn to is legitimate. Walk it seriously.' },
    { n: 91, level: 'neutral', title: '结草衔环', en: 'The Knotted Grass and the Jade Rings',
      story: 'A spared woman\'s father knotted grass to trip her saviour\'s enemy; a healed sparrow returned four rings of white jade.',
      verse: 'Kindness files no invoice yet is repaid in battle and in jade.',
      advice: 'An old good deed of yours is circling back. Keep planting them.' },
    { n: 92, level: 'caution', title: '精卫填海', en: 'Jingwei Fills the Sea',
      story: 'The drowned princess became a bird that drops pebbles into the ocean, vowing to fill it - grain by grain, forever.',
      verse: 'Admirable, endless, and the sea has not noticed.',
      advice: 'Honour your grief, but ask whether this fight can be won. Redirect the devotion.' },
    { n: 93, level: 'caution', title: '李广难封', en: 'The General Never Ennobled',
      story: 'The Flying General won seventy battles and terrified the steppe, yet through mistiming and politics died without the title lesser men received.',
      verse: 'Valour is necessary and not sufficient; the memo matters as much as the battle.',
      advice: 'Merit alone will not be noticed. Document, ally, and time your claims.' },
    { n: 94, level: 'neutral', title: '狡兔三窟', en: 'The Clever Hare\'s Three Burrows',
      story: 'Feng Xuan bought loyalty for his lord by burning the debt records, then built him two more refuges before trouble came.',
      verse: 'He shopped for goodwill when it was cheap and shelters before the rain.',
      advice: 'Build your fallback positions now, in calm weather.' },
    { n: 95, level: 'good', title: '班超投笔', en: 'Ban Chao Throws Down the Brush',
      story: 'A copyist in the archives, Ban Chao flung down his brush for a soldier\'s life in the western regions - and won thirty-six kingdoms for Han.',
      verse: 'The brush hit the desk and a frontier opened; the resume was wrong about him.',
      advice: 'The career change you keep dismissing deserves a real trial. You may be miscast.' },
    { n: 96, level: 'fair', title: '连中三元', en: 'Shang Lu\'s Triple First',
      story: 'Shang Lu took first place in all three tiers of the imperial examinations - provincial, metropolitan, palace - a feat of relentless completeness.',
      verse: 'Thrice examined, thrice first: mastery is a habit wearing three crowns.',
      advice: 'Prepare completely, not partially. Take every stage of this seriously.' },
    { n: 97, level: 'neutral', title: '曳尾涂中', en: 'Dragging Its Tail in the Mud',
      story: 'Offered the premiership, Zhuangzi pointed at a turtle: better alive dragging its tail in the mud than dead and venerated in a shrine box.',
      verse: 'The sacred shell is displayed; the muddy turtle is alive. Choose alive.',
      advice: 'Decline the gilded cage. Freedom is the compensation.' },
    { n: 98, level: 'fair', title: '八仙过海', en: 'The Eight Immortals Cross the Sea',
      story: 'Rather than ride clouds, the Eight Immortals crossed the sea each on their own instrument - sword, flute, flower basket, iron crutch.',
      verse: 'Eight travellers, eight vessels, one crossing; the sea respected each method equally.',
      advice: 'Cross your sea using your own gift, not a borrowed boat. All talents float if trusted.' },
    { n: 99, level: 'caution', title: '四面楚歌', en: 'Chu Songs on All Sides',
      story: 'In the final encirclement, Han soldiers sang the songs of Chu, and Xiang Yu\'s homesick army melted away by night.',
      verse: 'It was music, not arrows, that emptied the camp; morale is a wall that hears.',
      advice: 'Your people\'s mood is the real fortification. Tend it before the siege deepens.' },
    { n: 100, level: 'fair', title: '百川归海', en: 'All Rivers Reach the Sea',
      story: 'Every stream, however it wanders, arrives at the same sea - the hundredth stick closes the cylinder\'s circle.',
      verse: 'A hundred roads, one tide; whatever was asked, the water is already on its way home.',
      advice: 'Trust the long arc of what you have set in motion. Completion is gathering.' }
  ];

  // ── Dream dictionary (readings in the 周公解梦 tradition) ──
  const OMEN = {
    auspicious: { label: '吉 Auspicious', cls: 'omen-good' },
    neutral: { label: '平 Neutral', cls: 'omen-neutral' },
    caution: { label: '慎 Take Care', cls: 'omen-caution' }
  };

  const DREAMS = [
    {
      zh: '蛇', en: 'Snake', emoji: '🐍', omen: 'auspicious',
      reading: 'Coiled wealth — money is already moving toward you.',
      variants: 'Bitten: fortune arrives faster than expected. Fleeing: an opportunity slipping away. Many snakes: money from several directions at once.',
      insight: 'Act on the offer you have been circling for weeks.'
    },
    {
      zh: '龙', en: 'Dragon', emoji: '🐉', omen: 'auspicious',
      reading: 'The highest omen — recognition, elevation, a name lifted before important people.',
      variants: 'Rising: promotion or public notice. Sleeping: your moment is not yet ripe. Riding it: you are in control of the rise.',
      insight: 'Ask for the bigger role. You are already doing the work.'
    },
    {
      zh: '虎', en: 'Tiger', emoji: '🐅', omen: 'neutral',
      reading: 'Power meets you on the road.',
      variants: 'Calm tiger: authority won. Lunging: a rival with teeth. Riding one: a danger you cannot safely dismount from.',
      insight: 'Face the confrontation directly — hesitation will be read as weakness.'
    },
    {
      zh: '鼠', en: 'Rat', emoji: '🐀', omen: 'caution',
      reading: 'Something small is quietly gnawing at your stores.',
      variants: 'Many rats: scattered small losses. White rat: a hidden helper. Catching one: you find the leak.',
      insight: 'Audit the recurring costs you have stopped noticing.'
    },
    {
      zh: '牛', en: 'Ox', emoji: '🐂', omen: 'auspicious',
      reading: 'Slow wealth, sure wealth — harvest for patient labour.',
      variants: 'Ploughing: today\'s work pays later. Charging: overwork turning against you. Buying one: an asset worth holding.',
      insight: 'Choose what compounds over what pays out this month.'
    },
    {
      zh: '兔', en: 'Rabbit', emoji: '🐇', omen: 'auspicious',
      reading: 'The moon\'s own animal — quiet luck and narrow escapes.',
      variants: 'White rabbit: pure fortune. Running away: luck you will have to chase. Holding one: safety already in your hands.',
      insight: 'That near-miss was protection, not bad luck.'
    },
    {
      zh: '马', en: 'Horse', emoji: '🐎', omen: 'auspicious',
      reading: '马到成功 — success arrives the moment the horse does.',
      variants: 'Galloping: news travelling fast toward you. Fallen: a delay, not a defeat. Riding: you set the pace.',
      insight: 'Move on the thing you have been waiting for permission to do.'
    },
    {
      zh: '羊', en: 'Goat', emoji: '🐐', omen: 'auspicious',
      reading: 'Harmony and provision — the family gathered and fed.',
      variants: 'A flock: support around you. Lost goat: someone drifting from the family. Black goat: a stubborn relative.',
      insight: 'Make the call to the relative you keep postponing.'
    },
    {
      zh: '猴', en: 'Monkey', emoji: '🐒', omen: 'caution',
      reading: 'Cleverness that may be too clever for its own good.',
      variants: 'Playing: harmless mischief. Stealing: someone is outsmarting you. Caged: talent going to waste.',
      insight: 'Simplify the arrangement before you sign it.'
    },
    {
      zh: '鸡', en: 'Rooster', emoji: '🐓', omen: 'auspicious',
      reading: 'Something hidden will be announced in daylight.',
      variants: 'Crowing: news at dawn. Hen with chicks: increase in the family. Fighting cocks: a quarrel becoming public.',
      insight: 'Say it out loud — the secret is costing more than the telling.'
    },
    {
      zh: '狗', en: 'Dog', emoji: '🐕', omen: 'auspicious',
      reading: 'Loyalty stands guard over you.',
      variants: 'Friendly: a friend proving true. Barking: a warning worth heeding. Biting: betrayal by someone close.',
      insight: 'Trust the friend who tells you the unwelcome thing.'
    },
    {
      zh: '猪', en: 'Pig', emoji: '🐖', omen: 'auspicious',
      reading: 'Abundance without anxiety — the pig dreams only of plenty.',
      variants: 'Fat pig: money arriving easily. Piglets: small gains multiplying. Escaping: wealth leaking through habits.',
      insight: 'Enjoy the surplus, but bank a share of it first.'
    },
    {
      zh: '猫', en: 'Cat', emoji: '🐈', omen: 'neutral',
      reading: 'Something graceful is watching you with its own agenda.',
      variants: 'Purring: charm working in your favour. Scratching: a deceit surfacing. Black cat: a rival you have not identified.',
      insight: 'Verify the charming offer, and count your change.'
    },
    {
      zh: '鱼', en: 'Fish', emoji: '🐟', omen: 'auspicious',
      reading: '年年有余 — the fish is surplus itself.',
      variants: 'A big fish: a large windfall. Many: steady flow. A dead fish: a plan that has run its course.',
      insight: 'Deepen the source already feeding you instead of finding a new one.'
    },
    {
      zh: '鸟', en: 'Bird', emoji: '🐦', omen: 'neutral',
      reading: 'A message crosses distance to reach you.',
      variants: 'Singing: good news. Caged: news being withheld. Flying away: a chance departing.',
      insight: 'Answer the message you have left unread.'
    },
    {
      zh: '乌龟', en: 'Turtle', emoji: '🐢', omen: 'auspicious',
      reading: 'Longevity and protection over anything built slowly.',
      variants: 'Swimming: steady progress. Withdrawn into its shell: retreat is wise for now. On its back: someone near you is stuck and needs turning.',
      insight: 'Take the slow option — it will outlast the fast one.'
    },
    {
      zh: '大象', en: 'Elephant', emoji: '🐘', omen: 'auspicious',
      reading: 'Great weight moving gently — major fortune handled safely.',
      variants: 'Riding one: authority carried with ease. Charging: a big matter escaping control. White elephant: a gift that costs more to keep than it gives.',
      insight: 'Say yes to scale, no to what merely looks impressive.'
    },
    {
      zh: '鳄鱼', en: 'Crocodile', emoji: '🐊', omen: 'caution',
      reading: 'Still water hides old teeth.',
      variants: 'Submerged: a threat you cannot yet see. Snapping: an argument about to surface. Escaping one: you avoid a trap set for you.',
      insight: 'Be brief and courteous with the person testing your patience.'
    },
    {
      zh: '蝴蝶', en: 'Butterfly', emoji: '🦋', omen: 'auspicious',
      reading: 'Transformation completing — what crawled all year is ready to fly.',
      variants: 'Landing on you: a blessing choosing you. Many: a whole season of change. Trapped: growth you keep postponing.',
      insight: 'Release the old arrangement; it has finished its purpose.'
    },
    {
      zh: '蜘蛛', en: 'Spider', emoji: '🕷️', omen: 'neutral',
      reading: 'Patient work paying off thread by thread.',
      variants: 'Spinning: your effort is compounding. Walking into a web: a trap laid by another. Killing one: you break a scheme.',
      insight: 'Stay with the slow project one more week.'
    },
    {
      zh: '祖先', en: 'Deceased relative', emoji: '🕯️', omen: 'auspicious',
      reading: 'The tenderest of dreams — an ancestor visits to bless, never to warn.',
      variants: 'Smiling: approval of your path. Silent: simply company. Speaking: remember exactly what was said.',
      insight: 'Light incense and give thanks — and note any number or date they showed you.'
    },
    {
      zh: '神明', en: 'Deity', emoji: '⛩️', omen: 'auspicious',
      reading: 'You are seen; protection surrounds a decision you thought you faced alone.',
      variants: 'A statue: steady watch over you. A speaking deity: an instruction worth obeying. A hall of many gods: help arriving from several sides.',
      insight: 'Choose the right path rather than the easy one — you are not unsupported.'
    },
    {
      zh: '鬼', en: 'Ghost', emoji: '👻', omen: 'caution',
      reading: 'Unfinished business, not harm.',
      variants: 'A familiar ghost: something left unsaid to that person. Chasing you: a debt or guilt in pursuit. Fading: the matter is already resolving.',
      insight: 'Settle the thing you keep pretending to have forgotten.'
    },
    {
      zh: '婚礼', en: 'Wedding', emoji: '💒', omen: 'auspicious',
      reading: 'A union of matters — partnerships, mergers, promises made formal.',
      variants: 'Your own: a commitment approaching. Attending: someone else\'s fortune touching you. Interrupted: terms still unsettled.',
      insight: 'Read the agreement carefully before you celebrate it.'
    },
    {
      zh: '葬礼', en: 'Funeral', emoji: '⚰️', omen: 'auspicious',
      reading: 'Reversal — an ending that releases fortune.',
      variants: 'Of a stranger: a burden lifts. Of someone living: long life for them. Your own: a chapter closing well.',
      insight: 'Stop funding the thing that has already ended.'
    },
    {
      zh: '婴儿', en: 'Baby', emoji: '👶', omen: 'auspicious',
      reading: 'A new thing with your name on it — fragile now, mighty later.',
      variants: 'Crying: it needs attention today. Sleeping: it is growing quietly. Holding it: responsibility gladly taken.',
      insight: 'Give the new venture an hour a day, not one burst a month.'
    },
    {
      zh: '怀孕', en: 'Pregnancy', emoji: '🤰', omen: 'auspicious',
      reading: 'Something is growing that cannot yet be seen.',
      variants: 'Your own: a private plan is healthy. Another\'s: news coming from them. Difficult: the idea needs more time.',
      insight: 'Do not announce it before its month.'
    },
    {
      zh: '掉牙', en: 'Teeth falling', emoji: '🦷', omen: 'caution',
      reading: 'The old book reads this as worry for elders.',
      variants: 'Painless: a difficulty resolves without loss. Bleeding: a worry with a real cost. All at once: fear of losing standing.',
      insight: 'Call your parents this week.'
    },
    {
      zh: '飞翔', en: 'Flying', emoji: '🕊️', omen: 'auspicious',
      reading: 'Rising above what held you.',
      variants: 'High and calm: real elevation coming. Struggling to stay up: ambition outrunning support. Falling mid-flight: a plan needing a firmer base.',
      insight: 'Put your name forward for the thing you assume is out of reach.'
    },
    {
      zh: '坠落', en: 'Falling', emoji: '🌀', omen: 'caution',
      reading: 'The grip you fear losing may be the one worth releasing.',
      variants: 'Waking before you land: a warning. Landing safely: a burden dropped. Pushed: someone quietly undermining you.',
      insight: 'Let go of the commitment you hold on to out of pride.'
    },
    {
      zh: '被追', en: 'Being chased', emoji: '🏃', omen: 'caution',
      reading: 'What pursues you in sleep is what you avoid by day.',
      variants: 'An unseen pursuer: vague dread — name it and it shrinks. A known person: unresolved conflict. Turning to face it: the fear is already passing.',
      insight: 'Do the avoided task first thing tomorrow.'
    },
    {
      zh: '火', en: 'Fire', emoji: '🔥', omen: 'auspicious',
      reading: '火 means 旺 — fire is flourishing itself.',
      variants: 'Warm and contained: prosperity catching. Your house alight: change you did not choose but will profit from. Extinguished: an opportunity cooling.',
      insight: 'Feed the fire already burning; do not start a second one.'
    },
    {
      zh: '水灾', en: 'Flood', emoji: '🌊', omen: 'auspicious',
      reading: 'Water is wealth, and a flood is wealth past the banks.',
      variants: 'Rising: abundance beyond what you can hold. Muddy: money arriving with complications. Reaching high ground: you keep what matters.',
      insight: 'Hold on through the mess — do not sell in the panic.'
    },
    {
      zh: '下雨', en: 'Rain', emoji: '🌧️', omen: 'auspicious',
      reading: 'Heaven waters what you planted.',
      variants: 'Steady rain: reliable income. A storm passing: a dispute that clears the air. Rain indoors: trouble inside the home.',
      insight: 'Keep the routine — it is working even when it feels slow.'
    },
    {
      zh: '大海', en: 'Sea', emoji: '⛵', omen: 'neutral',
      reading: 'Your fortune has scale beyond the harbour.',
      variants: 'Calm: safe journeys and ventures abroad. Rough: wait for the next tide. Sinking: a venture beyond your depth.',
      insight: 'Take the bigger opportunity, but not without a crew.'
    },
    {
      zh: '高山', en: 'Mountain', emoji: '⛰️', omen: 'auspicious',
      reading: 'The obstacle is also the viewpoint.',
      variants: 'Climbing: a hard task worth its summit. Standing on top: it is already yours. A blocked path: a detour, not a defeat.',
      insight: 'Learn the skill rather than buying the shortcut.'
    },
    {
      zh: '庙宇', en: 'Temple', emoji: '🏮', omen: 'auspicious',
      reading: 'Guidance is nearer than you think.',
      variants: 'Entering: help is available if you ask. An empty temple: you are seeking in the wrong place. Praying: the answer is already forming in you.',
      insight: 'Ask your question plainly, of someone who can actually answer it.'
    },
    {
      zh: '钱', en: 'Money', emoji: '💵', omen: 'neutral',
      reading: 'A mixed omen — what you do with it in the dream is the message.',
      variants: 'Finding it: gain. Losing it: scattered attention. Counting it: anxiety about enough. Giving it away: generosity that returns.',
      insight: 'Look at your accounts calmly this week, without dread.'
    },
    {
      zh: '黄金', en: 'Gold', emoji: '🪙', omen: 'auspicious',
      reading: 'Not merely money — worth finally recognised.',
      variants: 'Wearing it: status arriving. Buried: talent unused. Fake gold: an offer that glitters and is not.',
      insight: 'Let someone appraise the thing you keep quiet about.'
    },
    {
      zh: '血', en: 'Blood', emoji: '🩸', omen: 'auspicious',
      reading: '见血见财 — to see blood is to see wealth on its way.',
      variants: 'A small cut: a quick small gain. Another\'s blood: money through a relationship. Stopping the bleeding: you protect what you have.',
      insight: 'Do not be spooked — look for the opportunity inside the shock.'
    },
    {
      zh: '车祸', en: 'Car accident', emoji: '🚗', omen: 'caution',
      reading: 'A collision of plans, not of cars.',
      variants: 'Witnessing one: someone else\'s crisis touches you. Driving: you are moving too fast. Walking away unhurt: a near miss you will recognise later.',
      insight: 'Slow one of your two competing commitments this week.'
    },
    {
      zh: '警察', en: 'Police', emoji: '👮', omen: 'neutral',
      reading: 'Order arrives, invited or not.',
      variants: 'Helped by them: protection and fair judgement. Chased: a rule you have been bending. Reporting to them: you want a matter settled properly.',
      insight: 'Straighten the paperwork before anyone asks for it.'
    },
    {
      zh: '小偷', en: 'Thief', emoji: '🥷', omen: 'caution',
      reading: 'Something of yours has quiet feet.',
      variants: 'Catching one: you reclaim what was slipping. Being robbed: time or credit taken. Being the thief: you are stealing from your own rest.',
      insight: 'Name what is draining away — hours, credit, or goodwill.'
    },
    {
      zh: '考试', en: 'Exam', emoji: '📝', omen: 'neutral',
      reading: 'You are being measured, or measuring yourself far too harshly.',
      variants: 'Unprepared: fear of exposure, not real lack. Passing: confidence returning. A blank paper: a decision you have not started.',
      insight: 'You are more prepared than the dream suggests. Begin.'
    },
    {
      zh: '榴莲', en: 'Durian', emoji: '🍈', omen: 'auspicious',
      reading: 'Fortune with a thorny shell — difficult, divisive, golden inside.',
      variants: 'Opening one: the reward is within reach. Pricked: a cost before the gain. Sharing it: profit best taken with others.',
      insight: 'Take the opportunity that others find off-putting.'
    },
    {
      zh: '房子', en: 'House', emoji: '🏠', omen: 'neutral',
      reading: 'The house is the self.',
      variants: 'New rooms: talents undiscovered. A leaking roof: body or savings needing maintenance. Bright and full: a settled heart. Empty: loneliness to tend.',
      insight: 'Repair the small thing at home you keep walking past.'
    },
    {
      zh: '飞机', en: 'Aeroplane', emoji: '✈️', omen: 'auspicious',
      reading: 'Distance shrinks for you.',
      variants: 'Boarding: travel or expansion approaching. Missing it: an opportunity with a deadline. Turbulence: a rough but completed journey.',
      insight: 'Keep your documents and your options ready.'
    },
    {
      zh: '闪电', en: 'Lightning', emoji: '⚡', omen: 'neutral',
      reading: 'Sudden illumination after long darkness.',
      variants: 'Distant: insight approaching. Striking near you: an abrupt change you did not choose. Lighting a path: the way forward is briefly, clearly visible.',
      insight: 'Write the idea down the moment it comes — it will not wait.'
    }
  ];

  // Three temple numbers per symbol: direct, mirrored, and the seeker's own
  // (personalised by today's date so the temple answers freshly each day).
  function dreamNumbers(key) {
    const direct = num4('dream:' + key);
    const mirror = direct.split('').reverse().join('');
    const daily = num4('dream:' + key + ':' + todaySG());
    return [
      { label: 'Temple Book', number: direct },
      { label: 'Mirror', number: mirror },
      { label: "Today's Sign", number: daily }
    ];
  }

  // ── Kau Chim: the full temple rite ──
  // 静心 still the heart → 摇签 hold-and-shake until a stick falls →
  // 掷筊 throw the moon blocks for the deity to confirm → the reading.
  const LS_KEY = 'temple_kauchim';
  const LS_STICKS = 'temple_sticks';

  const ASK_CATS = [
    { key: 'love', zh: '姻缘', en: 'Love', emoji: '🌸' },
    { key: 'wealth', zh: '财运', en: 'Wealth', emoji: '🪙' },
    { key: 'career', zh: '事业', en: 'Career', emoji: '⛰️' },
    { key: 'health', zh: '健康', en: 'Health', emoji: '🍃' },
    { key: 'study', zh: '学业', en: 'Studies', emoji: '📖' },
    { key: 'peace', zh: '平安', en: 'Peace', emoji: '🏮' }
  ];

  // What each fortune level says about each kind of question
  const CAT_ADVICE = {
    great: {
      love: 'A red thread is pulling taut — say the thing you have been saving.',
      wealth: 'The door is open; walk through it while the incense still burns.',
      career: 'Put your name on the bigger work. The timing will not be better.',
      health: 'Strength is returning faster than you feel it. Keep the routine.',
      study: 'Sit the paper, take the interview — this season favours you.',
      peace: 'The house is protected. Enjoy it aloud, gratefully.'
    },
    good: {
      love: 'Warmth grows where you water it. One sincere gesture this week.',
      wealth: 'Gains come through steadiness, not boldness. Collect what is owed.',
      career: 'A helpful senior is watching. Do the unglamorous task well.',
      health: 'Good, if you guard your sleep. The body is asking politely.',
      study: 'Effort lands now. One focused hour beats five distracted ones.',
      peace: 'Small frictions dissolve if you speak gently first.'
    },
    fair: {
      love: 'Neither push nor retreat — let the other person arrive.',
      wealth: 'Hold what you have; the better price comes to the patient.',
      career: 'A sideways move now beats a leap. Build the skill quietly.',
      health: 'Nothing alarming, everything improvable. Start with walking.',
      study: 'Progress is real but uneven. Review before you advance.',
      peace: 'Keep your own counsel this week; not every matter needs you.'
    },
    neutral: {
      love: 'The pot must simmer. Checking it constantly cools it.',
      wealth: 'A flat stretch, not a bad one. Spend nothing you would miss.',
      career: 'Stay at your post. Movement for its own sake wastes the season.',
      health: 'Maintain, do not overhaul. The dull habits are the medicine.',
      study: 'Consolidate. The exam rewards what you already half-know.',
      peace: 'Stillness is the answer to the question you asked.'
    },
    caution: {
      love: 'Do not force an answer from someone still finding theirs.',
      wealth: 'Guard the purse. Lend nothing you are not ready to lose.',
      career: 'Sign nothing in haste; a clause hides in the fine print.',
      health: 'Rest is not laziness — see to the small complaint before it grows.',
      study: 'Postpone the gamble; sit this one only when prepared.',
      peace: 'Walk away from the quarrel that wants you in it.'
    }
  };

  let askCat = null;       // chosen category object
  let pendingStick = null; // fortune drawn, awaiting the blocks
  let jiaoTries = 0;

  // ── Lazy 3D (three.js loads only when a 3D moment starts) ──
  let t3d = null, t3dTried = false;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function ensure3D() {
    if (t3dTried) return t3d;
    t3dTried = true;
    if (reducedMotion()) return null;
    try { t3d = await import('./temple3d.mjs'); } catch (e) { t3d = null; window.__err3d = 'import: ' + e.message; }
    return t3d;
  }

  let jiao3d = null, jiao3dTried = false;
  async function ensureJiao3D() {
    if (jiao3dTried) return jiao3d;
    jiao3dTried = true;
    const mod = await ensure3D();
    if (!mod) return null;
    try {
      jiao3d = mod.initJiao(document.getElementById('jiaoStage'));
      if (jiao3d) document.querySelector('.jiao-pair').style.display = 'none';
    } catch (e) { jiao3d = null; window.__err3d = 'init: ' + e.message; }
    if (!jiao3d && !window.__err3d) window.__err3d = 'initJiao returned null';
    return jiao3d;
  }

  const showStep = (id) => {
    ['ritualFocus', 'ritualShake', 'ritualJiao'].forEach(s =>
      document.getElementById(s).hidden = s !== id);
  };

  // ── Stick collection (签谱) ──
  const collected = () => {
    try { return JSON.parse(localStorage.getItem(LS_STICKS) || '[]'); } catch (e) { return []; }
  };

  function collect(n) {
    try {
      const c = collected();
      if (!c.includes(n)) { c.push(n); localStorage.setItem(LS_STICKS, JSON.stringify(c)); }
    } catch (e) {}
  }

  function renderCollection() {
    const c = collected();
    const box = document.getElementById('stickCollection');
    if (!c.length) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="ritual-step-label">签谱 Your collection · ${c.length} of ${FORTUNES.length} sticks</div>
      <div class="stick-grid">${FORTUNES.map(f =>
        `<span class="stick-cell${c.includes(f.n) ? ' got' : ''}" title="${c.includes(f.n) ? f.title : '未得 not yet drawn'}">${f.n}</span>`).join('')}</div>`;
  }

  function renderFortune(f, catKey) {
    const level = FORTUNE_LEVELS[f.level];
    const blessed = num4('stick:' + f.n + ':' + todaySG());
    const info = numberInfo(blessed);
    const cat = ASK_CATS.find(c => c.key === catKey);
    const catLine = cat ? `
        <div class="fortune-asked">You asked of ${cat.emoji} ${cat.zh} ${cat.en}</div>
        <p class="fortune-advice fortune-cat-advice">${CAT_ADVICE[f.level][cat.key]}</p>` : '';
    document.getElementById('kauchimResult').innerHTML = `
      <div class="fortune-card animate-in">
        <div class="fortune-stick-no">第 ${f.n} 签 · Lot No. ${f.n} of 100</div>
        <div class="fortune-title">${f.title}</div>
        <div class="fortune-en">${f.en}</div>
        <span class="badge fortune-level ${level.cls}">${level.label}</span>
        <p class="fortune-story"><span class="fortune-story-label">典故</span>${f.story}</p>
        <p class="fortune-verse">&ldquo;${f.verse}&rdquo;</p>
        <p class="fortune-advice">${f.advice}</p>
        ${catLine}
        <div class="fortune-number-block">
          <div class="fortune-number-label">Your blessed number for today</div>
          <div class="fortune-number">${blessed}</div>
          <div class="fortune-number-history">${info.text}</div>
        </div>
        <div class="share-row">
          <button class="temple-btn temple-btn-small" id="fortuneShare">📤 Share Blessing Card</button>
          <button class="temple-btn temple-btn-small btn-wa" id="fortuneWA">Share on WhatsApp</button>
        </div>
        <p class="temple-honesty">The temple speaks plainly: every 4D number carries the same 1-in-10,000 chance. This number is a blessing to carry, not a prediction.</p>
      </div>`;
    document.getElementById('fortuneShare').addEventListener('click', () =>
      shareCard(f.title, `第 ${f.n} 签 · ${level.label}`, blessed, info.text));
    document.getElementById('fortuneWA').addEventListener('click', () =>
      shareWhatsApp([
        '🏮 CaiShenYeah 财神爷 · The Digital Temple of Fortune',
        `第 ${f.n} 签 ${f.title} · ${level.label}`,
        `"${f.verse}"`,
        `My blessed number today: ${blessed}`,
        info.text,
        'Every number has the same 1-in-10,000 chance 🙏'
      ]));
    renderCollection();
    if (f.level === 'great') {
      ensure3D().then(mod => { if (mod) mod.goldRain(); });
      if (window.Sound) setTimeout(() => Sound.gong(), 400);
    }
  }

  // ── Moon blocks (掷筊) ──
  function setJiao(el, face) { // 'flat' or 'round'
    el.classList.remove('flat', 'round', 'tossing');
    void el.offsetWidth; // restart the animation
    el.classList.add('tossing', face);
  }

  function throwJiao() {
    const btn = document.getElementById('jiaoThrow');
    const note = document.getElementById('jiaoNote');
    btn.disabled = true;
    jiaoTries++;

    const r = Math.random();
    // Real blocks: 圣筊 50%, 笑筊 25%, 阴筊 25% — and at the temple,
    // the third throw is taken as the answer
    let outcome = r < 0.5 ? 'sheng' : r < 0.75 ? 'laugh' : 'yin';
    if (jiaoTries >= 3) outcome = 'sheng';

    const flip = Math.random() < 0.5;
    const faces = outcome === 'sheng'
      ? { a: flip ? 'flat' : 'round', b: flip ? 'round' : 'flat' }
      : { a: outcome === 'laugh' ? 'flat' : 'round', b: outcome === 'laugh' ? 'flat' : 'round' };

    const finish = () => {
      btn.disabled = false;
      if (outcome === 'sheng') {
        note.textContent = '圣筊 — one flat, one curved. The deity confirms this stick.';
        if (window.Sound) Sound.bowl();
        const f = pendingStick;
        try { localStorage.setItem(LS_KEY, JSON.stringify({ date: todaySG(), n: f.n, cat: askCat && askCat.key })); } catch (e) {}
        collect(f.n);
        setTimeout(() => {
          document.getElementById('ritualJiao').hidden = true;
          renderFortune(f, askCat && askCat.key);
        }, 900);
      } else if (outcome === 'laugh') {
        note.textContent = '笑筊 — both flat. The deity smiles: ask the question more sincerely, and throw again.';
      } else {
        note.textContent = '阴筊 — both curved. This stick is not your answer. Return and shake for another.';
        setTimeout(() => {
          showStep('ritualShake');
          document.getElementById('kauchimNote').textContent = 'The blocks said no — hold and shake for a different stick.';
        }, 1400);
      }
    };

    if (jiao3d) {
      if (navigator.vibrate) navigator.vibrate([25, 60, 20]);
      // Real 3D tumble: the clatter fires on the actual first floor impact
      jiao3d.throwBlocks(faces, () => { if (window.Sound) Sound.blocks(); })
        .then(() => setTimeout(finish, 250));
      return;
    }

    // SVG fallback
    if (window.Sound) setTimeout(() => Sound.blocks(), 600);
    const A = document.getElementById('jiaoA'), B = document.getElementById('jiaoB');
    setJiao(A, faces.a);
    setJiao(B, faces.b);
    setTimeout(finish, 950);
  }

  // ── The rite ──
  function initKauChim() {
    // Category chips start the rite
    const cats = document.getElementById('askCats');
    cats.innerHTML = ASK_CATS.map(c =>
      `<button class="dream-chip" data-cat="${c.key}">${c.emoji} ${c.zh} ${c.en}</button>`).join('');
    cats.addEventListener('click', (e) => {
      const chip = e.target.closest('.dream-chip');
      if (!chip) return;
      askCat = ASK_CATS.find(c => c.key === chip.dataset.cat);
      cats.querySelectorAll('.dream-chip').forEach(x =>
        x.classList.toggle('zodiac-active', x === chip));
      showStep('ritualShake');
      document.getElementById('kauchimNote').textContent =
        'Press and hold — keep shaking until a stick works itself free.';
    });

    // Photoreal cylinder with CSS fallback
    const stage = document.getElementById('kauchimStage');
    const photo = document.getElementById('kauchimPhoto');
    const cssCylinder = document.getElementById('kauchimCylinder');
    const useCss = () => { stage.hidden = true; cssCylinder.hidden = false; };
    photo.addEventListener('error', useCss);
    if (photo.error || (photo.complete && !photo.naturalWidth)) useCss();

    // Hold-to-shake: the stick creeps out WHILE you hold, coming free
    // somewhere between 4 and 8 seconds. Let go early and it slips back in.
    const btn = document.getElementById('kauchimShake');
    const shaker = () => stage.hidden ? cssCylinder : stage;
    const riseEl = document.getElementById('stickRise');
    let holding = false, advancing = false, holdStart = 0, riseTarget = 0, rattleLoop = null, riseRAF = null;

    const setStick = (p, wobble) => {
      const y = 105 - p * 99; // 105% buried -> 6% fully out
      const rot = wobble ? Math.sin(Date.now() / 65) * 1.5 * (1 - p * 0.4) : 0;
      riseEl.style.transform = `translateY(${y}%) rotate(${rot}deg)`;
    };

    const emerge = () => {
      holding = false;
      advancing = true;
      clearInterval(rattleLoop);
      cancelAnimationFrame(riseRAF);
      shaker().classList.remove('shaking');
      setStick(1, false);
      if (window.Sound) Sound.tok(); // it comes free of the rim
      if (navigator.vibrate) navigator.vibrate(35); // and you feel it
      document.getElementById('kauchimNote').textContent = 'It has come free.';
      setTimeout(() => {
        advancing = false;
        riseEl.classList.add('sinking');
        setStick(0, false); // reset for the next ask, unseen behind the step switch
        document.getElementById('jiaoStickNo').textContent = `第 ${pendingStick.n} 签`;
        document.getElementById('jiaoNote').textContent = '';
        document.getElementById('jiaoA').classList.remove('flat', 'round', 'tossing');
        document.getElementById('jiaoB').classList.remove('flat', 'round', 'tossing');
        showStep('ritualJiao');
        ensureJiao3D();
        setTimeout(() => riseEl.classList.remove('sinking'), 800);
      }, 1100);
    };

    const frame = () => {
      if (!holding) return;
      const p = Math.min(1, (Date.now() - holdStart) / riseTarget);
      setStick(p, true);
      if (p >= 1) { emerge(); return; }
      riseRAF = requestAnimationFrame(frame);
    };

    const stopHold = () => {
      if (!holding) return;
      holding = false;
      clearInterval(rattleLoop);
      cancelAnimationFrame(riseRAF);
      shaker().classList.remove('shaking');
      // The stick slips back into the cup
      riseEl.classList.add('sinking');
      setStick(0, false);
      setTimeout(() => riseEl.classList.remove('sinking'), 800);
      document.getElementById('kauchimNote').textContent =
        'It slipped back in — keep holding until the stick comes free.';
    };

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (holding || advancing) return;
      holding = true;
      holdStart = Date.now();
      riseTarget = 4000 + Math.random() * 4000; // the deity decides: 4-8s
      pendingStick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      jiaoTries = 0;
      riseEl.classList.remove('sinking');
      shaker().classList.add('shaking');
      document.getElementById('kauchimResult').innerHTML = '';
      document.getElementById('kauchimNote').textContent =
        'Keep holding — a stick is working itself loose…';
      if (window.Sound) { Sound.rattle(); rattleLoop = setInterval(() => Sound.rattle(), 1150); }
      frame();
    });
    btn.addEventListener('pointerup', stopHold);
    btn.addEventListener('pointerleave', stopHold);
    btn.addEventListener('pointercancel', stopHold);

    document.getElementById('jiaoThrow').addEventListener('click', throwJiao);

    // Restore today's confirmed stick
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (saved && saved.date === todaySG()) {
        const f = FORTUNES.find(x => x.n === saved.n);
        if (f) {
          renderFortune(f, saved.cat);
          document.getElementById('ritualFocus').querySelector('.ritual-guide').textContent =
            'The temple has already answered you today. You may ask again, but the first answer is the sincere one.';
        }
      }
    } catch (e) { /* localStorage unavailable — the rite still works */ }
    renderCollection();
  }

  // ── Dream dictionary rendering ──
  // A dream told in full can carry several signs: find every symbol the
  // temple book recognises in the text.
  const DREAM_SYNONYMS = {
    '蛇': ['serpent', 'python', 'cobra'],
    '祖先': ['grandmother', 'grandfather', 'grandma', 'grandpa', 'ancestor', 'passed away', 'late father', 'late mother'],
    '掉牙': ['tooth'],
    '钱': ['cash', 'wallet', 'salary'],
    '黄金': ['golden', 'jewellery', 'jewelry'],
    '婴儿': ['infant', 'newborn'],
    '房子': ['home', 'apartment', 'flat', 'hdb'],
    '车祸': ['crash', 'collision'],
    '大海': ['ocean', 'waves'],
    '下雨': ['raining', 'rainstorm'],
    '水灾': ['drowning', 'tsunami'],
    '飞机': ['plane', 'flight', 'airplane'],
    '被追': ['chasing', 'chased', 'pursued'],
    '飞翔': ['flew', 'fly', 'soaring'],
    '坠落': ['fell', 'fall'],
    '考试': ['test', 'examination'],
    '神明': ['god', 'goddess', 'buddha', 'guanyin', 'deities'],
    '鬼': ['spirit', 'haunted', 'phantom'],
    '婚礼': ['marry', 'married', 'marriage', 'bride', 'groom'],
    '葬礼': ['burial', 'coffin', 'cemetery'],
    '鱼': ['koi', 'goldfish', 'arowana'],
    '警察': ['policeman', 'cop'],
    '小偷': ['stolen', 'robber', 'burglar', 'steal'],
    '闪电': ['thunder', 'storm'],
    '火': ['flames', 'burning', 'burn'],
    '虎': ['tigers'],
    '龙': ['dragons'],
    '狗': ['puppy', 'dogs'],
    '猫': ['kitten', 'cats'],
    '鼠': ['rats', 'mouse', 'mice'],
    '猪': ['pigs', 'boar'],
    '马': ['horses', 'pony'],
    '鸟': ['birds', 'sparrow', 'eagle', 'owl'],
    '乌龟': ['tortoise'],
    '怀孕': ['pregnant'],
    '高山': ['mountains', 'hill', 'climbing'],
    '庙宇': ['shrine', 'pagoda', 'monastery']
  };

  const esc2 = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function matchDreams(text) {
    const q = text.toLowerCase();
    const wordHit = (w) => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(q);
    const found = [];
    for (const d of DREAMS) {
      const keys = [d.en.toLowerCase(), ...(DREAM_SYNONYMS[d.zh] || [])];
      // multi-word names also match on their significant words, unless that
      // word is itself another symbol's name (teeth falling vs falling)
      for (const w of d.en.toLowerCase().split(/\s+/)) {
        if (w.length > 3 && !DREAMS.some(o => o !== d && o.en.toLowerCase() === w)) keys.push(w);
      }
      const hit = q.includes(d.zh) || keys.some(k => k.includes(' ') ? q.includes(k) : wordHit(k));
      if (hit) found.push(d);
    }
    return found;
  }

  function numbersBlock(nums) {
    return `
        <div class="dream-numbers">
          ${nums.map(x => {
            const info = numberInfo(x.number);
            return `
              <div class="dream-number-item">
                <div class="dream-number-label">${x.label}</div>
                <div class="dream-number">${x.number}</div>
                <div class="fortune-number-history">${info.text}</div>
              </div>`;
          }).join('')}
        </div>`;
  }

  function honestyLine() {
    return `<p class="temple-honesty">Dream numbers are drawn from the temple book, not from probability — every number has the same 1-in-10,000 chance. Strike history is real, from ${results.length.toLocaleString()} actual draws.</p>`;
  }

  function wireShare(title, sub, nums) {
    document.getElementById('dreamShare').addEventListener('click', () =>
      shareCard(title, sub, nums[0].number, `Mirror ${nums[1].number} · Today's Sign ${nums[2].number}`));
    document.getElementById('dreamResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderDreamResult(symbol) {
    const nums = dreamNumbers(symbol.zh || symbol.en);
    const title = symbol.emoji
      ? `${symbol.emoji} ${symbol.en} <span class="dream-zh">${symbol.zh}</span>`
      : `&ldquo;${esc2(symbol.en)}&rdquo;`;
    const reading = symbol.reading
      ? `
        <div class="dream-reading-head">
          <span class="dream-meaning-label">周公解梦 · The Temple Book reads</span>
          <span class="badge dream-omen ${OMEN[symbol.omen].cls}">${OMEN[symbol.omen].label}</span>
        </div>
        <p class="dream-meaning">${symbol.reading}</p>
        <dl class="dream-detail">
          <dt>变 If the dream differed</dt><dd>${symbol.variants}</dd>
          <dt>宜 What it asks of you</dt><dd>${symbol.insight}</dd>
        </dl>`
      : `
        <div class="dream-reading-head">
          <span class="dream-meaning-label">周公解梦 · The Temple Book reads</span>
        </div>
        <p class="dream-meaning">This dream has no entry in the temple book — it belongs to you alone. Its numbers are read from the dream’s own words; its meaning, only the dreamer can say.</p>`;
    document.getElementById('dreamResult').innerHTML = `
      <div class="card animate-in dream-result-card">
        <div class="card-title">${title}</div>
        ${reading}
        ${numbersBlock(nums)}
        <div class="share-row">
          <button class="temple-btn temple-btn-small" id="dreamShare">📤 Share Blessing Card</button>
          <button class="temple-btn temple-btn-small btn-wa" id="dreamWA">Share on WhatsApp</button>
        </div>
        ${honestyLine()}
      </div>`;
    document.getElementById('dreamWA').addEventListener('click', () =>
      shareWhatsApp([
        '🌙 CaiShenYeah 解梦 Dream Numbers',
        `Dreamt of ${symbol.en}${symbol.zh ? ' ' + symbol.zh : ''}`,
        symbol.reading ? `"${symbol.reading}"` : '',
        `Temple Book ${nums[0].number} · Mirror ${nums[1].number} · Today's Sign ${nums[2].number}`,
        'Every number has the same 1-in-10,000 chance 🙏'
      ]));
    wireShare(`${symbol.emoji || '🌙'} ${symbol.zh || symbol.en}`, `Dream: ${symbol.en}`, nums);
  }

  // A whole dream, told in the dreamer's words: read every sign in it
  function renderDreamTelling(text) {
    const matches = matchDreams(text).slice(0, 4);
    if (matches.length <= 1) {
      renderDreamResult(matches[0] || { en: text, zh: '', emoji: '' });
      return;
    }
    const nums = dreamNumbers(text.toLowerCase());
    const good = matches.filter(m => m.omen === 'auspicious').length;
    const wary = matches.filter(m => m.omen === 'caution').length;
    const weave =
      wary === 0 ? 'The signs agree — this dream leans towards fortune.'
      : good === 0 ? 'The signs counsel care — walk gently this week.'
      : 'The signs pull in different directions; where they disagree, the temple book counsels the gentler path.';
    document.getElementById('dreamResult').innerHTML = `
      <div class="card animate-in dream-result-card">
        <div class="card-title">&ldquo;${esc2(text)}&rdquo;</div>
        <div class="dream-reading-head">
          <span class="dream-meaning-label">周公解梦 · The Temple Book reads ${matches.length} signs in this dream</span>
        </div>
        <p class="dream-meaning">${weave}</p>
        ${matches.map(m => `
          <div class="dream-sign">
            <div class="dream-sign-head">
              <span class="dream-sign-name">${m.emoji} ${m.en} <span class="dream-zh">${m.zh}</span></span>
              <span class="badge dream-omen ${OMEN[m.omen].cls}">${OMEN[m.omen].label}</span>
            </div>
            <p class="dream-sign-reading">${m.reading}</p>
            <p class="dream-sign-insight">宜 ${m.insight}</p>
          </div>`).join('')}
        ${numbersBlock(nums)}
        <div class="share-row">
          <button class="temple-btn temple-btn-small" id="dreamShare">📤 Share Blessing Card</button>
          <button class="temple-btn temple-btn-small btn-wa" id="dreamWA">Share on WhatsApp</button>
        </div>
        ${honestyLine()}
      </div>`;
    document.getElementById('dreamWA').addEventListener('click', () =>
      shareWhatsApp([
        '🌙 CaiShenYeah 解梦 Dream Numbers',
        `My dream: "${text}"`,
        `The temple book read ${matches.length} signs: ${matches.map(m => m.zh + ' ' + m.en).join(', ')}`,
        `Temple Book ${nums[0].number} · Mirror ${nums[1].number} · Today's Sign ${nums[2].number}`,
        'Every number has the same 1-in-10,000 chance 🙏'
      ]));
    wireShare(`🌙 ${matches.map(m => m.zh).join(' ')}`, `Dream of ${matches.map(m => m.en.toLowerCase()).join(', ')}`.slice(0, 60), nums);
  }

  function initDreams() {
    const grid = document.getElementById('dreamGrid');
    const search = document.getElementById('dreamSearch');

    function drawGrid(filter) {
      const q = (filter || '').trim().toLowerCase();
      const shown = DREAMS.filter(d =>
        !q || d.en.toLowerCase().includes(q) || d.zh.includes(q));
      grid.innerHTML = shown.map((d) =>
        `<button class="dream-chip" data-i="${DREAMS.indexOf(d)}">${d.emoji} ${d.en}<span class="dream-zh">${d.zh}</span></button>`
      ).join('');
      // A told dream (several words, or nothing matching) always offers a full telling
      if (q && (!shown.length || /\s/.test(q))) {
        grid.innerHTML = `<button class="dream-chip dream-chip-custom" data-custom="${esc2(q)}">🌙 Tell this dream &ldquo;${esc2(q)}&rdquo;</button>` + grid.innerHTML;
      }
    }

    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.dream-chip');
      if (!chip) return;
      if (chip.dataset.custom !== undefined) {
        renderDreamTelling(chip.dataset.custom);
      } else {
        renderDreamResult(DREAMS[Number(chip.dataset.i)]);
      }
    });

    search.addEventListener('input', () => drawGrid(search.value));
    drawGrid('');
  }

  // ── Number checker rendering ──
  function initChecker() {
    const form = document.getElementById('checkerForm');
    const input = document.getElementById('checkerInput');
    const out = document.getElementById('checkerResult');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      const nums = [...new Set(raw.split(/[,;/]+/).map(normalizeNumber).filter(Boolean))].slice(0, 8);
      if (!nums.length) {
        out.innerHTML = '<p style="text-align:center;color:var(--white-muted);">The temple needs at least one digit to read.</p>';
        return;
      }
      const latest = results[0];
      out.innerHTML = nums.map(num => {
        const d = numberDetail(num);
        const won = d.latestPrize;
        const verdict = won
          ? `<span class="badge badge-hot">🎉 ${won} — Draw #${latest.drawNo}!</span>`
          : `<span class="badge badge-cold">Not in Draw #${latest.drawNo}</span>`;
        const breakdown = Object.entries(d.byPrize).map(([p, n]) => `${p} ×${n}`).join(' · ');
        const recent = d.strikes.slice(0, 5).map(s =>
          `<div class="checker-strike"><span>Draw #${s.drawNo} · ${s.date}</span><span class="gold-text">${s.prize}</span></div>`).join('');
        return `
          <div class="card animate-in checker-card">
            <div class="checker-head">
              <span class="checker-number">${num}</span>
              ${verdict}
            </div>
            ${d.strikes.length
              ? `<p class="checker-summary">Struck <strong class="gold-text">${d.strikes.length}×</strong> in ${results.length.toLocaleString()} draws — ${breakdown}</p>${recent}`
              : `<p class="checker-summary">Never struck in ${results.length.toLocaleString()} draws since ${results[results.length - 1].date.slice(0, 4)} — a fresh number, still holding its blessing.</p>`}
          </div>`;
      }).join('');
    });
  }

  // ── Daily blessings: zodiac, almanac, festivals ──
  const ZODIAC = [
    { zh: '鼠', en: 'Rat', emoji: '🐀' }, { zh: '牛', en: 'Ox', emoji: '🐂' },
    { zh: '虎', en: 'Tiger', emoji: '🐅' }, { zh: '兔', en: 'Rabbit', emoji: '🐇' },
    { zh: '龙', en: 'Dragon', emoji: '🐉' }, { zh: '蛇', en: 'Snake', emoji: '🐍' },
    { zh: '马', en: 'Horse', emoji: '🐎' }, { zh: '羊', en: 'Goat', emoji: '🐐' },
    { zh: '猴', en: 'Monkey', emoji: '🐒' }, { zh: '鸡', en: 'Rooster', emoji: '🐓' },
    { zh: '狗', en: 'Dog', emoji: '🐕' }, { zh: '猪', en: 'Pig', emoji: '🐖' }
  ];

  const ALMANAC_GOOD = ['placing a small bet', 'visiting family', 'settling a debt', 'starting a new habit', 'tidying the house', 'making a plan', 'reconciling with an old friend', 'learning something new', 'resting early', 'giving to charity', 'cooking at home', 'a long walk'];
  const ALMANAC_AVOID = ['chasing losses', 'big-ticket purchases', 'quarrels over money', 'lending money', 'signing in haste', 'gossip', 'late nights', 'impulsive bets', 'empty promises', 'borrowed luck'];
  const ALMANAC_COLORS = ['Gold', 'Red', 'Jade Green', 'White', 'Azure Blue', 'Purple'];
  const ALMANAC_DIRECTIONS = ['North', 'South', 'East', 'West', 'Northeast', 'Southeast', 'Northwest', 'Southwest'];

  const FESTIVALS = [
    { date: '2026-09-25', zh: '中秋节', en: 'Mid-Autumn Festival', emoji: '🥮' },
    { date: '2026-12-22', zh: '冬至', en: 'Dongzhi (Winter Solstice)', emoji: '🍡' },
    { date: '2027-02-06', zh: '新年', en: 'Chinese New Year — Year of the Goat', emoji: '🧧' },
    { date: '2027-02-10', zh: '迎财神', en: "God of Fortune's Day (正月初五)", emoji: '🏮' },
    { date: '2027-04-05', zh: '清明', en: 'Qing Ming', emoji: '🌿' }
  ];

  const LS_ZODIAC = 'temple_zodiac';

  function pickN(list, n, seed) {
    const out = [];
    const pool = [...list];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(pool.splice(hash(seed + ':' + i) % pool.length, 1)[0]);
    }
    return out;
  }

  function renderZodiac(zh) {
    const z = ZODIAC.find(x => x.zh === zh);
    if (!z) return;
    document.querySelectorAll('#zodiacGrid .dream-chip').forEach(c =>
      c.classList.toggle('zodiac-active', c.dataset.zh === zh));
    const num = num4('zodiac:' + zh + ':' + todaySG());
    const info = numberInfo(num);
    document.getElementById('zodiacResult').innerHTML = `
      <div class="fortune-number-block" style="text-align:center;margin-top:16px;">
        <div class="fortune-number-label">${z.emoji} ${z.en} — today's number</div>
        <div class="fortune-number" style="font-size:2rem;">${num}</div>
        <div class="fortune-number-history">${info.text}</div>
      </div>`;
  }

  function initDaily() {
    // Zodiac
    const grid = document.getElementById('zodiacGrid');
    grid.innerHTML = ZODIAC.map(z =>
      `<button class="dream-chip" data-zh="${z.zh}">${z.emoji} ${z.zh}</button>`).join('');
    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.dream-chip');
      if (!chip) return;
      try { localStorage.setItem(LS_ZODIAC, chip.dataset.zh); } catch (err) {}
      renderZodiac(chip.dataset.zh);
    });
    try {
      const saved = localStorage.getItem(LS_ZODIAC);
      if (saved) renderZodiac(saved);
    } catch (e) {}

    // Almanac
    const today = todaySG();
    document.getElementById('almanacDate').textContent =
      new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' });
    const good = pickN(ALMANAC_GOOD, 2, 'good:' + today);
    const avoid = pickN(ALMANAC_AVOID, 2, 'avoid:' + today);
    const color = ALMANAC_COLORS[hash('color:' + today) % ALMANAC_COLORS.length];
    const dir = ALMANAC_DIRECTIONS[hash('dir:' + today) % ALMANAC_DIRECTIONS.length];
    document.getElementById('almanacContent').innerHTML = `
      <div class="almanac-row"><span class="almanac-label good">宜 Auspicious</span><span>${good.join(', ')}</span></div>
      <div class="almanac-row"><span class="almanac-label bad">忌 Avoid</span><span>${avoid.join(', ')}</span></div>
      <div class="almanac-row"><span class="almanac-label">Lucky colour</span><span class="gold-text">${color}</span></div>
      <div class="almanac-row"><span class="almanac-label">Lucky direction</span><span class="gold-text">${dir}</span></div>
      <p class="temple-honesty" style="margin-top:14px;">The almanac renews daily — guidance for the spirit, not the wallet.</p>`;

    // Festivals
    const upcoming = FESTIVALS.filter(f => f.date >= today);
    document.getElementById('festivalContent').innerHTML = upcoming.map((f, i) => {
      const days = Math.round((new Date(f.date + 'T00:00:00+08:00') - new Date()) / 86400000);
      const when = days === 0 ? '🎉 Today!' : `in ${days} day${days === 1 ? '' : 's'}`;
      return `
        <div class="almanac-row${i === 0 ? ' festival-next' : ''}">
          <span>${f.emoji} ${f.en} <span class="dream-zh">${f.zh}</span></span>
          <span class="${i === 0 ? 'gold-text' : ''}">${f.date} · ${when}</span>
        </div>`;
    }).join('');
  }

  // ── Prayer wall ──
  const LS_WISH = 'temple_wish';
  let wallLoaded = false;

  const esc = (s) => s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderWall(wishes, count) {
    const wall = document.getElementById('wishWall');
    if (!wishes.length) {
      wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">The wall is bare — be the first to hang a wish.</p>';
    } else {
      wall.innerHTML = wishes.map(w => `
        <div class="wish-plaque">
          <div class="wish-plaque-text">${esc(w.wish)}</div>
          <div class="wish-plaque-meta">${w.name ? esc(w.name) : '无名 Anonymous'} · ${new Date(w.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })}</div>
        </div>`).join('');
    }
    if (count > wishes.length) {
      document.getElementById('wishCount').textContent =
        `${count.toLocaleString()} wishes hang on this wall — showing the newest ${wishes.length}.`;
    } else {
      document.getElementById('wishCount').textContent = '';
    }
  }

  function loadWishes() {
    if (wallLoaded) return;
    wallLoaded = true;
    const wall = document.getElementById('wishWall');
    wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Reading the wall&hellip;</p>';
    fetch('/api/wishes')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => renderWall(d.wishes || [], d.count || 0))
      .catch(() => {
        wallLoaded = false;
        wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">The wall rests for now — wishes return when the temple reopens.</p>';
      });
  }

  function initPrayerWall() {
    const form = document.getElementById('wishForm');
    const note = document.getElementById('wishNote');
    const btn = document.getElementById('wishSubmit');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(LS_WISH) === todaySG()) {
          note.textContent = 'The temple has already hung your wish today. Return tomorrow.';
          return;
        }
      } catch (err) {}

      const wish = document.getElementById('wishText').value.trim();
      if (wish.length < 2) return;
      btn.disabled = true;
      note.textContent = 'Hanging your wish…';

      fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wish,
          name: document.getElementById('wishName').value.trim(),
          altar: form.querySelector('.wish-altar').value
        })
      })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(() => {
          try { localStorage.setItem(LS_WISH, todaySG()); } catch (err) {}
          note.textContent = '🙏 Your wish hangs on the wall.';
          document.getElementById('wishText').value = '';
          if (window.Sound) Sound.bowl();
          wallLoaded = false;
          loadWishes();
        })
        .catch(() => { note.textContent = 'The wind took your wish — please try again.'; })
        .finally(() => { btn.disabled = false; });
    });
  }

  // ── The Living Altar ──
  // Feed-ready: when a temple partners, set liveUrl to their stream embed and
  // name the temple. Everything below already works; nothing else changes.
  const ALTAR = {
    liveUrl: null,              // e.g. 'https://www.youtube.com/embed/<id>?autoplay=1&mute=1'
    templeName: null,           // e.g. '福德祠 Fu De Temple'
    rounds: ['08:00', '18:00']  // SGT times a caretaker offers the bundle
  };

  const LS_OFFERING = 'temple_offering';
  let altarFramed = false;

  function sgMinutes() {
    const t = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date());
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function nextRound() {
    const now = sgMinutes();
    const mins = ALTAR.rounds.map(r => {
      const [h, m] = r.split(':').map(Number);
      return h * 60 + m;
    }).sort((a, b) => a - b);
    const upcoming = mins.find(x => x > now);
    const at = upcoming !== undefined ? upcoming : mins[0];
    return { at, away: upcoming !== undefined ? at - now : 1440 - now + at };
  }

  function fmtTime(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
  }

  const safeLink = (u) => (typeof u === 'string' && /^https:\/\//.test(u)) ? u : null;

  function renderAltarFrame() {
    if (altarFramed) return; // never rebuild: it would restart the stream
    altarFramed = true;
    const frame = document.getElementById('altarFrame');
    if (ALTAR.liveUrl) {
      frame.innerHTML = `
        <iframe src="${esc(ALTAR.liveUrl)}" allow="autoplay; encrypted-media" allowfullscreen title="Live temple altar"></iframe>
        <span class="altar-badge live">● LIVE · ${esc(ALTAR.templeName || 'The temple altar')}</span>`;
    } else {
      // Mock feed: what the frame will show once a temple's camera is connected
      frame.innerHTML = `
        <video src="altar-live.mp4" autoplay muted loop playsinline></video>
        <span class="altar-badge">DEMO FEED · no temple connected yet</span>`;
      document.getElementById('altarIntro').textContent =
        'A real altar, a real flame — once a temple joins us. This is a mock-up of the feed; the round below already works: names gather, and a caretaker will light them at the altar itself.';
    }
  }

  function renderRoundLine(pendingCount) {
    const { at, away } = nextRound();
    const h = Math.floor(away / 60), m = away % 60;
    document.getElementById('altarRound').innerHTML = `
      <span class="altar-round-time">Next round ${fmtTime(at)} SGT</span>
      <span class="altar-round-dot">·</span><span>in ${h ? h + 'h ' : ''}${m}m</span>
      <span class="altar-round-dot">·</span><span class="gold-text">${pendingCount} waiting</span>`;
  }

  function renderAltar(d) {
    const pending = d.pending || [], offered = d.offered || [];
    renderRoundLine(d.pendingCount || 0);

    document.getElementById('altarQueue').innerHTML = pending.length
      ? pending.map(o => `<div class="altar-name"><span>${esc(o.name)}</span>${
          o.dedication ? `<span class="altar-ded">${esc(o.dedication)}</span>` : ''}</div>`).join('')
      : '<p class="altar-empty">Nobody is waiting. Yours would be the first stick of the round.</p>';

    document.getElementById('altarOffered').innerHTML = offered.length
      ? offered.map(o => {
          const clip = safeLink(o.clip);
          const when = new Date(o.offeredAt).toLocaleString('en-SG',
            { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' });
          return `<div class="altar-name offered"><span>${esc(o.name)}</span><span class="altar-ded">🪔 ${when}${
            clip ? ` · <a href="${esc(clip)}" target="_blank" rel="noopener noreferrer">watch</a>` : ''}</span></div>`;
        }).join('')
      : '<p class="altar-empty">No round has been offered yet.</p>';
  }

  function loadAltar() {
    renderAltarFrame();
    renderRoundLine(0);
    fetch('/api/offerings', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderAltar)
      .catch(() => {
        document.getElementById('altarQueue').innerHTML =
          '<p class="altar-empty">The altar is quiet just now — try again shortly.</p>';
      });
  }

  function initAltar() {
    const form = document.getElementById('offeringForm');
    const note = document.getElementById('offeringNote');
    const btn = document.getElementById('offeringSubmit');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(LS_OFFERING) === todaySG()) {
          note.textContent = 'You have already joined a round today. One offering a day.';
          return;
        }
      } catch (err) {}

      const name = document.getElementById('offeringName').value.trim();
      if (!name) return;
      btn.disabled = true;
      note.textContent = 'Adding your name to the round…';

      fetch('/api/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dedication: document.getElementById('offeringDedication').value.trim(),
          altar: form.querySelector('.wish-altar').value
        })
      })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(() => {
          try { localStorage.setItem(LS_OFFERING, todaySG()); } catch (err) {}
          note.textContent = '🪔 Your name is in the next round. We will show it here once the caretaker has offered it.';
          document.getElementById('offeringDedication').value = '';
          if (window.Sound) Sound.bowl();
          loadAltar();
        })
        .catch(() => { note.textContent = 'The altar did not take your name — please try again.'; })
        .finally(() => { btn.disabled = false; });
    });
  }

  // ── Altar board: the display that stands beside the real altar ──
  function loadBoard() {
    document.getElementById('boardTemple').textContent = ALTAR.templeName || '';
    fetch('/api/offerings', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const names = d.pending || [];
        document.getElementById('boardNames').innerHTML = names.length
          ? names.map(o => `<div class="board-name">${esc(o.name)}${
              o.dedication ? `<span>${esc(o.dedication)}</span>` : ''}</div>`).join('')
          : '<div class="board-empty">静候 · awaiting names</div>';
        const { at } = nextRound();
        document.getElementById('boardFoot').textContent =
          `${names.length} offering${names.length === 1 ? '' : 's'} · round at ${fmtTime(at)}`;
      })
      .catch(() => {});
  }

  // Board is a wall display: keep it fresh without anyone touching it
  setInterval(() => {
    const v = document.querySelector('.view.active');
    if (v && v.dataset.view === 'board') loadBoard();
  }, 30000);

  // ── Temple keeper (moderation) ──
  const LS_KEEPER = 'temple_keeper';

  const keeperKey = () => {
    try { return localStorage.getItem(LS_KEEPER) || ''; } catch (e) { return ''; }
  };

  function renderKeeperWall(wishes, count) {
    const wall = document.getElementById('keeperWall');
    document.getElementById('keeperCount').textContent =
      count ? `${count.toLocaleString()} wishes on the wall.` : '';
    if (!wishes.length) {
      wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">No wishes hang on the wall yet.</p>';
      return;
    }
    wall.innerHTML = wishes.map(w => `
      <div class="wish-plaque" data-id="${esc(w.id || '')}">
        <div class="wish-plaque-text">${esc(w.wish)}</div>
        <div class="wish-plaque-meta">${w.name ? esc(w.name) : '无名 Anonymous'} · ${new Date(w.ts).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })}</div>
        <button class="wish-remove" title="Take this wish down">✕</button>
      </div>`).join('');
  }

  function loadKeeperAltar() {
    const box = document.getElementById('keeperAltar');
    box.hidden = !keeperKey();
    if (box.hidden) return;
    fetch('/api/offerings', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const n = d.pendingCount || 0;
        document.getElementById('keeperRoundState').innerHTML = n
          ? `<strong class="gold-text">${n}</strong> name${n === 1 ? '' : 's'} waiting for the next round.`
          : 'Nobody is waiting. Nothing to offer right now.';
      })
      .catch(() => { document.getElementById('keeperRoundState').textContent = 'Could not read the round.'; });
  }

  function loadKeeperWall() {
    const wall = document.getElementById('keeperWall');
    const note = document.getElementById('keeperNote');
    loadKeeperAltar();
    document.getElementById('keeperWallTitle').hidden = !keeperKey();
    if (!keeperKey()) {
      wall.innerHTML = '';
      document.getElementById('keeperCount').textContent = '';
      note.textContent = 'The room is locked.';
      return;
    }
    note.textContent = 'Unlocked. Click ✕ on a plaque to take it down.';
    wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Reading the wall&hellip;</p>';
    fetch('/api/wishes?limit=200', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => renderKeeperWall(d.wishes || [], d.count || 0))
      .catch(() => { wall.innerHTML = '<p style="text-align:center;color:var(--white-muted);">Could not read the wall.</p>'; });
  }

  function initKeeper() {
    const form = document.getElementById('keeperForm');
    const input = document.getElementById('keeperKey');
    const note = document.getElementById('keeperNote');
    const wall = document.getElementById('keeperWall');

    if (keeperKey()) input.value = keeperKey();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = input.value.trim();
      if (!key) {
        try { localStorage.removeItem(LS_KEEPER); } catch (err) {}
        loadKeeperWall();
        return;
      }
      try { localStorage.setItem(LS_KEEPER, key); } catch (err) {}
      loadKeeperWall();
    });

    // Record a round the caretaker has already made at the altar
    document.getElementById('keeperRoundForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const rNote = document.getElementById('keeperRoundNote');
      const rBtn = document.getElementById('keeperRoundBtn');
      rBtn.disabled = true;
      rNote.textContent = 'Recording the round…';

      fetch('/api/offerings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-temple-key': keeperKey() },
        body: JSON.stringify({ clip: document.getElementById('keeperClip').value.trim() })
      })
        .then(r => {
          if (r.status === 401) {
            try { localStorage.removeItem(LS_KEEPER); } catch (err) {}
            throw new Error('key');
          }
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(d => {
          rNote.textContent = d.offered
            ? `🪔 Round recorded — ${d.offered} offering${d.offered === 1 ? '' : 's'} now shown as made.`
            : 'Nobody was waiting, so nothing changed.';
          document.getElementById('keeperClip').value = '';
          // The blob listing trails the writes by a moment, so state the known
          // outcome now and reconcile shortly after
          document.getElementById('keeperRoundState').textContent =
            'Nobody is waiting. Nothing to offer right now.';
          setTimeout(loadKeeperAltar, 3000);
        })
        .catch(err => {
          rNote.textContent = err.message === 'key'
            ? 'That key was not accepted. Enter it again.'
            : 'Could not record the round — try again.';
        })
        .finally(() => { rBtn.disabled = false; });
    });

    wall.addEventListener('click', (e) => {
      const btn = e.target.closest('.wish-remove');
      if (!btn) return;
      const plaque = btn.closest('.wish-plaque');
      const id = plaque && plaque.dataset.id;
      if (!id) return;
      btn.disabled = true;
      plaque.classList.add('removing');

      fetch('/api/wishes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-temple-key': keeperKey() },
        body: JSON.stringify({ id })
      })
        .then(r => {
          if (r.status === 401) {
            try { localStorage.removeItem(LS_KEEPER); } catch (err) {}
            throw new Error('key');
          }
          if (!r.ok) throw new Error(r.status);
          plaque.remove();
          note.textContent = 'Wish taken down.';
          wallLoaded = false; // public wall refetches on next visit
        })
        .catch(err => {
          plaque.classList.remove('removing');
          btn.disabled = false;
          note.textContent = err.message === 'key'
            ? 'That key was not accepted. Enter it again.'
            : 'Could not take that wish down — try again.';
        });
    });
  }

  // ── Init ──
  window.addEventListener('DOMContentLoaded', () => {
    initKauChim();
    initDreams();
    initChecker();
    initDaily();
    initAltar();
    initPrayerWall();
    initKeeper();
  });

  return { hash, num4, dreamNumbers, numberInfo, numberDetail, normalizeNumber,
    loadWishes, loadKeeperWall, loadAltar, loadBoard, ALTAR, FORTUNES, DREAMS };
})();
