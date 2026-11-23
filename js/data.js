// Default game content (Tagalog version). Answers are listed top-ranked first.
// The answers were picked using web research (polls, popularity lists, film endings).
// The POINTS are estimates, not a real 100-person survey. Run a survey and update them in /admin.

export const DEFAULT_CONFIG = {
  version: 3,
  title: 'ADOBO YEP 2026',
  subtitle: 'Paskong Feud',
  season: 'ADOBO Year-End Party 2026',
  teams: ['Bibingka', 'Puto Bumbong'],

  // Main-game lineup: question id from the bank + point multiplier.
  rounds: [
    { qid: 'r-ulam',     mult: 1, label: 'Normal na Puntos' },
    { qid: 'r-leave',    mult: 1, label: 'Normal na Puntos' },
    { qid: 'r-loveteam', mult: 2, label: 'Dobleng Puntos' },
    { qid: 'r-anime',    mult: 2, label: 'Dobleng Puntos' },
    { qid: 'r-movie',    mult: 2, label: 'Dobleng Puntos' },
    { qid: 'r-marvel',   mult: 2, label: 'Dobleng Puntos' },
    { qid: 'r-masakit',  mult: 3, label: 'Tripleng Puntos' },
    { qid: 'r-pasok',    mult: 3, label: 'Tripleng Puntos' },  // last round: its intro says "Huling Round"
  ],

  // Off by default: the game ends after the last round and the highest score wins.
  fastMoney: {
    enabled: false,
    qids: ['fm-noche', 'fm-regalo', 'fm-ninang', 'fm-kanta', 'fm-resolusyon'],
    target: 200,
    players: 2,
    timers: [20, 25],
    countsToScore: true,
    bonus: 0,
  },

  bank: [
    // ---------- Main-game rounds (from the organizers' list) ----------
    // Dishes with repeated names: halo-halo, sapin-sapin, pichi-pichi, gising-gising (FreePressJournal, SBS).
    // Kare-kare is back in: the question no longer excludes it.
    { id: 'r-ulam', kind: 'round', isNew: true, q: 'Pagkaing Pinoy na inuulit ang pangalan.', answers: [
      ['Kare-kare', 24], ['Halo-halo', 20], ['Bola-bola', 14], ['Kwek-kwek', 11],
      ['Sapin-sapin', 9], ['Pichi-pichi', 8], ['Gising-gising', 7], ['Bilo-bilo', 5] ] },
    // Vacation is the most-requested leave in PH; bereavement and personal errands follow (Jibble, SEEK PH).
    { id: 'r-leave', kind: 'round', isNew: true, q: 'Bukod sa may sakit, bakit ka nagle-leave sa trabaho?', answers: [
      ['Bakasyon / Biyahe', 30], ['May namatay / Burol', 18], ['Lakad (bangko, ID, papeles)', 14], ['Birthday', 10],
      ['Pahinga / Mental health', 10], ['Kasal', 7], ['Exam / Board exam', 5], ['Hangover', 4] ] },
    { id: 'r-masakit', kind: 'round', isNew: true, q: 'Magbigay ng bagay na masakit pero masarap.', answers: [
      ['Pag-ibig', 25], ['Masahe / Hilot', 19], ['Maanghang na pagkain', 15], ['Pagkamot ng kagat ng lamok', 11],
      ['Pagbalik sa ex', 9], ['Ngalay pagkatapos mag-gym', 7], ['Hugot na kanta', 6], ['Waxing', 4] ] },
    { id: 'r-pasok', kind: 'round', isNew: true, q: 'Magbigay ng bagay na pinapasok sa katawan ng tao.', answers: [
      ['Iniksyon / Karayom', 24], ['Pagkain', 20], ['Gamot', 15], ['Suwero / Dextrose', 12],
      ['Hikaw', 9], ['Thermometer', 7], ['Swab', 6], ['Espiritu / Kaluluwa', 4] ] },
    // Dead in the MCU as of Nov 2026. Avengers: Doomsday opens Dec 18 2026, so re-check if the party is after that.
    { id: 'r-marvel', kind: 'round', isNew: true, q: 'Magbigay ng Marvel character na patay na (sa ngayon).', answers: [
      ['Iron Man', 30], ['Black Widow', 20], ['Thanos', 12], ['Black Panther (T\'Challa)', 10],
      ['Vision', 7], ['Quicksilver', 6], ['Heimdall', 5], ['Yondu', 5] ] },
    // Attack on Titan tops Japanese "most surprising premiere" polls (Goo Ranking) and fan lists (Ranker).
    { id: 'r-anime', kind: 'round', isNew: true, q: 'Anong anime ang may pinakamagandang Episode 1?', answers: [
      ['Attack on Titan', 26], ['Demon Slayer', 15], ['Death Note', 13], ['Oshi no Ko', 11],
      ['Frieren', 9], ['Chainsaw Man', 8], ['Jujutsu Kaisen', 7], ['Naruto', 6] ] },
    // The Nerve survey: Bea & John Lloyd #1 and KathNiel #2 all-time; Twitter: AlDub, KathNiel, JaDine; classics: Guy & Pip, Sharon & Gabby.
    { id: 'r-loveteam', kind: 'round', isNew: true, q: 'Pinakasikat na loveteam sa Pilipinas sa lahat ng panahon?', answers: [
      ['KathNiel', 24], ['Bea at John Lloyd', 20], ['AlDub', 14], ['JaDine', 11],
      ['Guy at Pip', 9], ['Sharon at Gabby', 8], ['LizQuen', 6], ['KimXi', 5] ] },
    // The lead dies: Heneral Luna (assassinated), Miracle in Cell No. 7 PH (executed), Kita Kita (Tonyo),
    // Jose Rizal (executed), Die Beautiful (Trisha), Himala (Elsa), Goyo (del Pilar), Hihintayin Kita sa Langit.
    { id: 'r-movie', kind: 'round', isNew: true, q: 'Sikat na Tagalog movie kung saan namatay ang bida.', answers: [
      ['Heneral Luna', 22], ['Miracle in Cell No. 7', 18], ['Kita Kita', 14], ['Jose Rizal', 11],
      ['Die Beautiful', 10], ['Himala', 8], ['Goyo', 7], ['Hihintayin Kita sa Langit', 5] ] },

    // ---------- Christmas alternates (swap into the lineup in /admin) ----------
    { id: 'r-noche', kind: 'round', q: 'Magbigay ng pagkaing hindi puwedeng mawala sa Noche Buena.', answers: [
      ['Hamon', 26], ['Queso de bola', 20], ['Spaghetti', 15], ['Fruit salad', 12],
      ['Lechon', 10], ['Bibingka / Puto bumbong', 7], ['Leche flan', 6], ['Pansit', 4] ] },
    { id: 'r-regalo', kind: 'round', q: 'Magbigay ng karaniwang regalo sa exchange gift.', answers: [
      ['Tumbler', 28], ['Mug', 18], ['Tuwalya', 14], ['Gift certificate', 11],
      ['Pitaka', 9], ['Kandila', 8], ['Pera / Ampao', 7], ['Bluetooth speaker', 5] ] },

    // ---------- Fast Money (off by default; turn on in /admin) ----------
    { id: 'fm-noche', kind: 'fm', q: 'Magbigay ng pagkain sa Noche Buena.', answers: [
      ['Hamon', 34], ['Queso de bola', 24], ['Spaghetti', 16], ['Lechon', 12], ['Fruit salad', 8], ['Leche flan', 6] ] },
    { id: 'fm-regalo', kind: 'fm', q: 'Magbigay ng karaniwang exchange gift.', answers: [
      ['Tumbler', 36], ['Mug', 22], ['Tuwalya', 16], ['Gift certificate', 12], ['Pitaka', 8], ['Kandila', 6] ] },
    { id: 'fm-ninang', kind: 'fm', q: 'Magbigay ng bagay na binibigay ng ninong o ninang.', answers: [
      ['Pera / Ampao', 48], ['Laruan', 20], ['Damit', 12], ['Tsokolate', 10], ['Wala (nagtago)', 10] ] },
    { id: 'fm-kanta', kind: 'fm', q: 'Magbigay ng Christmas song na naririnig na pagdating ng Setyembre.', answers: [
      ['All I Want for Christmas Is You', 40], ['Christmas in Our Hearts', 26], ['Pasko Na Sinta Ko', 12], ['Last Christmas', 12], ['Jingle Bells', 10] ] },
    { id: 'fm-resolusyon', kind: 'fm', q: 'Magbigay ng New Year\'s resolution.', answers: [
      ['Mag-diet / Mag-gym', 38], ['Mag-ipon', 26], ['Matulog nang maaga', 14], ['Mag-biyahe', 12], ['Bawasan ang kape', 10] ] },
  ],
};

export const RULES = [
  'Hulaan ng bawat team ang pinakasikat na sagot sa survey.',
  'Nagsisimula ang bawat round sa face-off.',
  'Ang makakuha ng mas mataas na sagot ang may kontrol.',
  'Puwedeng pumili ang team: PLAY o PASS.',
  'Hanggang tatlong strike (mali) lang bawat team.',
  'May puntos ang bawat tamang sagot.',
  'Pagkatapos ng tatlong strike, puwedeng mang-agaw ang kalaban.',
  'Nadadagdag ang puntos sa bawat round.',
  'Ang Fast Money ang huling hamon.',
  'Ang may pinakamataas na kabuuang puntos ang panalo.',
];
