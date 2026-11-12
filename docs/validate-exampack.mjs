// Quiz Word 시험 팩 검증기 (형식 버전 1) — 자동 생성 파일, 고치지 마세요.
// 원본: scripts/docs/validate-exampack.entry.ts + src/lib/exampack.ts (npm run docs:build)
// 사용: node validate-exampack.mjs <파일.exampack.json> [--json]   종료 코드 0 = 통과, 1 = 오류, 2 = 파일을 읽지 못함
// 가이드: https://swpark3179.github.io/Quiz-Word/exam-pack-guide.md

// src/lib/corpus.ts
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function wordRegex(w) {
  const alts = [w.word, ...w.forms ?? []].map((s) => s.trim()).filter(Boolean).sort((a, b) => b.length - a.length).map((s) => escapeRe(s).replace(/\s+/g, "\\s+") + (/[a-z]$/i.test(s) ? "(?:e?s)?" : ""));
  return new RegExp(`(?<![A-Za-z0-9_-])(?:${alts.join("|")})(?![A-Za-z0-9_-])`, "i");
}

// src/lib/schema.ts
var LEVELS = [
  { level: 1, name: "초등" },
  { level: 2, name: "중학" },
  { level: 3, name: "고등 기본" },
  { level: 4, name: "수능" },
  { level: 5, name: "대학·공인영어" },
  { level: 6, name: "전문·기술" }
];
var MAX_LEVEL = LEVELS.length;
var DEFAULT_LEVEL = 4;
var POS_LIST = [
  "명사",
  "동사",
  "형용사",
  "부사",
  "전치사",
  "접속사",
  "대명사",
  "한정사",
  "감탄사",
  "약어",
  "명사구",
  "동사구",
  "형용사구",
  "부사구",
  "전치사구"
];
var DOMAINS = [
  "생성·추가",
  "삭제·제거",
  "변경·수정",
  "확인·검증",
  "실행·처리",
  "이동·전달",
  "저장·기록",
  "검색·조회",
  "비교·평가·판단",
  "제어·제한·관리",
  "연결·통합",
  "요청·소통",
  "시작·종료",
  "오류·실패·위험",
  "원인·결과·영향",
  "정도·양·크기",
  "시간·순서·빈도",
  "구조·구성·부분",
  "데이터·정보·문서",
  "시스템·도구·기술",
  "사람·조직·역할",
  "상태·성질",
  "정확·품질·신뢰",
  "계획·목표·전략",
  "비즈니스·업무",
  "논리·관계·연결어",
  "일반"
];

// src/lib/normalize.ts
function normalizeLevel(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_LEVEL ? v : DEFAULT_LEVEL;
}
var splitPos = (p) => (Array.isArray(p) ? p : (p ?? "").split(/[·,/]/)).map((x) => x.trim()).filter(Boolean);
function shortFromMeaning(meaning) {
  const first = meaning.split(/②/)[0];
  return first.replace(/[①-⑨]/g, "").replace(/\([^)]*[A-Za-z][^)]*\)/g, "").split(/\s[—–-]\s/)[0].replace(/\s+/g, " ").trim() || meaning;
}
function normalizeMemory(m) {
  if (!m) return void 0;
  const text = (s) => s?.trim() || void 0;
  const story = text(m.story);
  const hook = text(m.hook);
  if (!story && !hook) return void 0;
  const roots = (m.roots ?? []).filter((x) => x?.part?.trim() && x.ko?.trim()).map((x) => ({ part: x.part.trim(), ko: x.ko.trim() }));
  const family = (m.family ?? []).map((x) => x?.trim()).filter((x) => !!x);
  const origin = text(m.origin);
  return {
    ...roots.length ? { roots } : {},
    ...origin ? { origin } : {},
    ...story ? { story } : {},
    ...hook ? { hook } : {},
    ...family.length ? { family } : {}
  };
}
function normalizeWord(r) {
  const pos = splitPos(r.pos);
  const meaning = r.meaning ?? "";
  const senses = r.senses?.length ? r.senses : [{ pos: pos[0] ?? "명사", ko: shortFromMeaning(meaning) }];
  const memory = normalizeMemory(r.memory);
  return {
    id: r.id ?? "",
    word: r.word ?? "",
    level: normalizeLevel(r.level),
    pos,
    ...r.ipa ? { ipa: r.ipa.replace(/^\/|\/$/g, "") } : {},
    meaning,
    short: r.short?.trim() || shortFromMeaning(meaning),
    senses,
    ...r.forms?.length ? { forms: r.forms } : {},
    ...r.synonyms?.length ? { synonyms: r.synonyms } : {},
    domain: r.domain ?? "일반",
    ...memory ? { memory } : {},
    freq: 0,
    occ: {},
    contexts: []
  };
}

// src/lib/exams.ts
var isQuizSource = (s) => s.kind !== "wordbook";

// src/lib/checks.ts
var ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var LEGACY_WORD_FIELDS = ["tier", "basic", "freq", "sources", "contexts", "note"];
var MEMORY_LIMITS = { story: 80, hook: 60, origin: 50 };
var MAX_EXAMPLES = 4;
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var isStr = (v) => typeof v === "string";
var strList = (v) => Array.isArray(v) && v.every(isStr);
var POS = POS_LIST;
function checkWord(r, where, out, opts = {}) {
  const err = (m2) => out.errors.push(`${where}: ${m2}`);
  const warn = (m2) => out.warns.push(`${where}: ${m2}`);
  const strict = !!opts.strict;
  if (!isObj(r)) {
    err("단어 항목은 객체");
    return void 0;
  }
  for (const f of ["id", "word", "pos", "meaning"]) {
    const v = r[f];
    if (!v || Array.isArray(v) && !v.length) err(`필수 필드 "${f}" 없음`);
  }
  if (!isStr(r.id) || !r.id || !isStr(r.word) || !r.word) return void 0;
  let broken = false;
  const bad = (m2) => {
    err(m2);
    broken = true;
  };
  if (r.pos !== void 0 && !isStr(r.pos) && !strList(r.pos)) bad("pos 는 문자열 또는 문자열 배열");
  else if (strict && r.pos !== void 0 && !Array.isArray(r.pos)) err('pos 는 문자열 배열 (예: ["동사", "명사"])');
  if (r.meaning !== void 0 && !isStr(r.meaning)) bad("meaning 은 문자열");
  if (r.short !== void 0 && !isStr(r.short)) bad("short 는 문자열");
  if (r.ipa !== void 0 && !isStr(r.ipa)) bad("ipa 는 문자열");
  if (r.domain !== void 0 && !isStr(r.domain)) bad("domain 은 문자열");
  if (r.forms !== void 0 && !strList(r.forms)) bad("forms 는 문자열 배열");
  if (r.synonyms !== void 0 && !strList(r.synonyms)) bad("synonyms 는 문자열 배열");
  if (r.senses !== void 0 && (!Array.isArray(r.senses) || r.senses.some((s) => !isObj(s) || !isStr(s.pos) || !isStr(s.ko) || !s.ko.trim()))) {
    bad("senses 는 [{ pos, ko }] 배열");
  }
  const m = r.memory;
  if (m !== void 0) {
    if (!isObj(m)) bad("memory 는 객체");
    else {
      for (const k of ["origin", "story", "hook"]) if (m[k] !== void 0 && !isStr(m[k])) bad(`memory.${k} 는 문자열`);
      if (m.roots !== void 0 && !Array.isArray(m.roots)) bad("memory.roots 는 배열");
      else if (Array.isArray(m.roots) && m.roots.some((x) => !isObj(x) || !isStr(x.part) || !isStr(x.ko) || !x.part.trim() || !x.ko.trim())) bad("memory.roots 항목에 part·ko 가 다 있어야 함");
      if (m.family !== void 0 && !strList(m.family)) bad("memory.family 는 문자열 배열");
    }
  }
  if (!ID_RE.test(r.id)) err("id 는 소문자·숫자·하이픈만");
  if (r.level === void 0) err(`level(1~${MAX_LEVEL}) 없음`);
  else if (typeof r.level !== "number" || !Number.isInteger(r.level) || r.level < 1 || r.level > MAX_LEVEL) err(`level 은 1~${MAX_LEVEL} 의 정수`);
  for (const k of LEGACY_WORD_FIELDS) if (k in r) err(`"${k}" 는 사전에 적지 않는다 — 시험 폴더(data/exams)로`);
  if (broken) return void 0;
  const raw = r;
  const w = normalizeWord(raw);
  for (const p of w.pos) if (!POS.includes(p)) err(`알 수 없는 품사 "${p}"`);
  for (const s of w.senses) if (!POS.includes(s.pos)) err(`senses 품사 "${s.pos}"`);
  if (!DOMAINS.includes(w.domain)) err(`알 수 없는 domain "${w.domain}"`);
  if (strict && !raw.domain) err("domain 없음");
  if (strict && !raw.senses?.length) err("senses 없음 (뜻을 하나 이상)");
  if (!raw.short) (strict ? err : warn)(strict ? "short 없음 (객관식 보기에 쓰는 짧은 뜻)" : "short 없음 (객관식 보기에 meaning 을 줄여 씀)");
  else if (/[A-Za-z]/.test(raw.short)) warn("short 에 영어가 있음 — 보기에서 정답이 드러날 수 있음");
  if (w.short.length > 26) warn(`short 가 김 (${w.short.length}자)`);
  const dupSense = w.senses.map((s) => s.ko).filter((ko, i, all) => all.indexOf(ko) !== i);
  if (dupSense.length) (strict ? err : warn)(`senses 에 같은 뜻이 두 번: "${dupSense[0]}"`);
  if (raw.memory !== void 0) {
    if (!w.memory) err("memory 에 story(어원 장면)나 hook(발음 연상) 중 하나는 있어야 함");
    if (raw.memory.family?.some((f) => f.toLowerCase() === w.word.toLowerCase())) (strict ? err : warn)("memory.family 에 자기 자신이 있음");
    for (const [k, max] of Object.entries(MEMORY_LIMITS)) {
      const v = w.memory?.[k];
      if (v && v.length > max) (strict ? err : warn)(`memory.${k} 가 김 (${v.length}자, ${max}자 이하)`);
    }
  } else if (strict && typeof r.level === "number" && r.level >= 2) err("2단계 이상인 단어에는 memory(외우기)가 있어야 함");
  return w;
}
var folderLabels = (id) => ({
  exam: `exams/${id}`,
  index: `exams/${id}/index.json`,
  examples: (src) => `exams/${id}/examples/${src}.json`,
  sentences: (src) => `exams/${id}/sentences/${src}.json`,
  notes: `exams/${id}/notes.json`
});
function checkExam(exam, dict, out, labels = folderLabels(exam.id)) {
  const { errors, warns } = out;
  const at = labels.exam;
  if (!isStr(exam.id) || !ID_RE.test(exam.id)) errors.push(`${at}: 시험 id 는 소문자·숫자·하이픈만`);
  if (!isStr(exam.name) || !exam.name.trim()) errors.push(`${at}: name 없음`);
  if (exam.order !== void 0 && typeof exam.order !== "number") errors.push(`${at}: order 는 숫자`);
  const srcIds = /* @__PURE__ */ new Set();
  const quiz = /* @__PURE__ */ new Set();
  if (!Array.isArray(exam.sources)) errors.push(`${at}: sources 는 [{ id, name }] 배열`);
  else {
    for (const s of exam.sources) {
      if (!isObj(s)) {
        errors.push(`${at}: sources 항목은 { id, name }`);
        continue;
      }
      if (!isStr(s.id) || !ID_RE.test(s.id)) errors.push(`${at}: 문제 파일 id "${String(s.id)}" 는 소문자·숫자·하이픈만`);
      else if (srcIds.has(s.id)) errors.push(`${at}: 문제 파일 id 중복 "${s.id}"`);
      if (!isStr(s.name) || !s.name.trim()) errors.push(`${at}: 문제 파일 ${String(s.id)} 에 name 없음`);
      if (s.kind !== void 0 && s.kind !== "quiz" && s.kind !== "wordbook") errors.push(`${at}: 문제 파일 ${String(s.id)} 의 kind 는 quiz / wordbook`);
      if (isStr(s.id)) {
        srcIds.add(s.id);
        if (isQuizSource(s)) quiz.add(s.id);
      }
    }
    if (!quiz.size) warns.push(`${at}: 문제 파일이 하나도 없음`);
  }
  if (exam.index !== void 0 && !isObj(exam.index)) errors.push(`${labels.index}: { 단어 id: { 문제 파일 id: 횟수 } } 객체가 아님`);
  else {
    for (const [id, bySrc] of Object.entries(exam.index ?? {})) {
      if (!dict.has(id)) errors.push(`${labels.index}: 사전에 없는 단어 "${id}"`);
      if (!isObj(bySrc) || !Object.keys(bySrc).length) errors.push(`${labels.index} › ${id}: { 문제 파일: 횟수 } 가 비어 있음`);
      else {
        for (const [src, n] of Object.entries(bySrc)) {
          if (!quiz.has(src)) errors.push(`${labels.index} › ${id}: 문제 파일 목록에 없는 "${src}"`);
          if (typeof n !== "number" || !Number.isInteger(n) || n < 1) errors.push(`${labels.index} › ${id}: ${src} 의 횟수는 1 이상의 정수`);
        }
      }
    }
  }
  let exampleCount = 0;
  if (exam.examples !== void 0 && !isObj(exam.examples)) errors.push(`${at}: examples 는 { 문제 파일 id: { 단어 id: [예문] } } 객체`);
  else {
    const perWord = /* @__PURE__ */ new Map();
    for (const [src, byWord] of Object.entries(exam.examples ?? {})) {
      const file = labels.examples(src);
      if (!srcIds.has(src)) errors.push(`${file}: sources 에 없는 문제 파일`);
      if (!isObj(byWord)) {
        errors.push(`${file}: { 단어 id: [예문] } 객체가 아님`);
        continue;
      }
      for (const [id, list] of Object.entries(byWord)) {
        const w = dict.get(id);
        if (!w) {
          errors.push(`${file}: 사전에 없는 단어 "${id}"`);
          continue;
        }
        if (!Array.isArray(list)) {
          errors.push(`${file} › ${id}: 예문 목록이 배열이 아님`);
          continue;
        }
        perWord.set(id, (perWord.get(id) ?? 0) + list.length);
        for (const c of list) {
          exampleCount++;
          if (!isObj(c) || !isStr(c.en) || !isStr(c.surface) || !isStr(c.sense) || !isStr(c.pos) || !c.surface) {
            errors.push(`${file} › ${id}: 예문에 en·surface·pos·sense 가 다 있어야 함`);
            continue;
          }
          if (!c.en.toLowerCase().includes(c.surface.toLowerCase())) errors.push(`${file} › ${id}: 예문에 "${c.surface}" 없음`);
          if (!w.senses.some((s) => s.ko === c.sense)) errors.push(`${file} › ${id}: 문맥 뜻 "${c.sense}" 가 senses 에 없음`);
          if (!POS.includes(c.pos)) errors.push(`${file} › ${id}: 알 수 없는 품사 "${c.pos}"`);
          if (c.q !== void 0 && (typeof c.q !== "number" || !Number.isInteger(c.q) || c.q < 0)) errors.push(`${file} › ${id}: q 는 0 이상의 정수`);
          if (c.n !== void 0 && typeof c.n !== "number") errors.push(`${file} › ${id}: n 은 숫자`);
          if (c.ko !== void 0 && !isStr(c.ko)) errors.push(`${file} › ${id}: ko 는 문자열`);
        }
      }
    }
    for (const [id, n] of perWord) if (n > MAX_EXAMPLES) warns.push(`${at}: ${id} 의 예문이 ${n}개 — 단어마다 ${MAX_EXAMPLES}개까지가 기준`);
  }
  if (exam.sentences !== void 0 && !isObj(exam.sentences)) errors.push(`${at}: sentences 는 { 문제 파일 id: [문장] } 객체`);
  else {
    for (const [src, list] of Object.entries(exam.sentences ?? {})) {
      const file = labels.sentences(src);
      if (!quiz.has(src)) errors.push(`${file}: 문제 파일 목록에 없는 파일`);
      if (!Array.isArray(list) || list.some((x) => !isObj(x) || !isStr(x.en) || x.ko !== void 0 && !isStr(x.ko) || x.q !== void 0 && (typeof x.q !== "number" || !Number.isInteger(x.q) || x.q < 0))) {
        errors.push(`${file}: [{ q, en, ko? }] 형식이 아님`);
      }
    }
  }
  if (exam.notes !== void 0 && !isObj(exam.notes)) errors.push(`${labels.notes}: { 단어 id: 마크다운 } 객체가 아님`);
  else {
    for (const [id, md] of Object.entries(exam.notes ?? {})) {
      if (!dict.has(id)) errors.push(`${labels.notes}: 사전에 없는 단어 "${id}"`);
      if (!isStr(md)) errors.push(`${labels.notes} › ${id}: 노트는 문자열`);
    }
  }
  return exampleCount;
}

// src/lib/exampack.ts
var EXAMPACK_APP = "quiz-word";
var EXAMPACK_KIND = "exampack";
var EXAMPACK_VERSION = 1;
function slugId(word) {
  return word.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
var isObj2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var WORD_KEYS = ["id", "word", "level", "pos", "ipa", "meaning", "short", "senses", "forms", "synonyms", "domain", "memory"];
var TOP_KEYS = ["app", "kind", "version", "builtAt", "exam", "words", "$schema"];
var EXAM_KEYS = ["id", "name", "order", "sources", "index", "examples", "sentences", "notes"];
var packLabels = {
  exam: "exam",
  index: "exam.index",
  examples: (src) => `exam.examples.${src}`,
  sentences: (src) => `exam.sentences.${src}`,
  notes: "exam.notes"
};
function cleanWord(r) {
  const out = {};
  for (const k of WORD_KEYS) if (r[k] !== void 0) out[k] = k === "memory" ? normalizeMemory(r[k]) : r[k];
  if (out.memory === void 0) delete out.memory;
  return out;
}
function validateExamPack(data) {
  const errors = [];
  const warns = [];
  const out = { errors, warns };
  if (!isObj2(data)) return { errors: ["시험 팩이 아닙니다 (JSON 객체가 아님)"], warns };
  if (data.app === EXAMPACK_APP && isObj2(data.cards)) return { errors: ["진행 기록 파일이에요. 진행 기록은 설정 → 진행 기록 → 가져오기에서 불러오세요."], warns };
  if (data.app === EXAMPACK_APP && data.kind === "wordset") return { errors: ["단어 세트 파일이에요 (사전 전체를 바꾸는 파일). 설정 → 단어 세트 → 파일에서 불러오기로 여세요."], warns };
  if (data.app !== EXAMPACK_APP) errors.push(`app 은 "${EXAMPACK_APP}"`);
  if (data.kind !== EXAMPACK_KIND) errors.push(`kind 는 "${EXAMPACK_KIND}"`);
  if (typeof data.version !== "number") errors.push(`version 은 숫자 ${EXAMPACK_VERSION}`);
  else if (data.version > EXAMPACK_VERSION) errors.push(`이 앱이 모르는 시험 팩 형식이에요 (버전 ${data.version}). 앱을 먼저 업데이트하세요.`);
  else if (data.version < 1) errors.push(`version 은 ${EXAMPACK_VERSION}`);
  if (typeof data.builtAt !== "string" || Number.isNaN(new Date(data.builtAt).getTime())) errors.push('builtAt 은 만든 시각 (ISO 8601 문자열, 예: "2026-11-12T09:00:00.000Z")');
  for (const k of Object.keys(data)) if (!TOP_KEYS.includes(k)) warns.push(`모르는 필드 "${k}" — 쓰이지 않습니다`);
  const dict = /* @__PURE__ */ new Map();
  const cleaned = [];
  if (!Array.isArray(data.words) || !data.words.length) errors.push("words 는 단어 항목의 배열 (하나 이상)");
  else {
    const seenIds = /* @__PURE__ */ new Set();
    const heads = /* @__PURE__ */ new Map();
    const surfaces = /* @__PURE__ */ new Map();
    data.words.forEach((r, i) => {
      const id = isObj2(r) && typeof r.id === "string" ? r.id : "";
      const where = `words[${i}]${id ? ` (${id})` : ""}`;
      const w = checkWord(r, where, out, { strict: true });
      if (!isObj2(r) || typeof r.id !== "string" || typeof r.word !== "string") return;
      if (r.id && r.word && r.id !== slugId(r.word)) errors.push(`${where}: id 는 "${slugId(r.word)}" 여야 함 (표제어 "${r.word}" 를 소문자·하이픈으로 바꾼 값)`);
      for (const k of Object.keys(r)) if (!WORD_KEYS.includes(k) && !["tier", "basic", "freq", "sources", "contexts", "note"].includes(k)) warns.push(`${where}: 모르는 필드 "${k}" — 쓰이지 않습니다`);
      if (seenIds.has(r.id)) errors.push(`${where}: 같은 id 가 두 번 이상 있음`);
      seenIds.add(r.id);
      const head = r.word.toLowerCase();
      if (heads.has(head) && heads.get(head) !== r.id) errors.push(`${where}: 표제어 "${r.word}" 가 ${heads.get(head)} 와 겹침`);
      heads.set(head, r.id);
      if (!w) return;
      for (const s of [w.word, ...w.forms ?? []].map((x) => x.toLowerCase())) {
        const owner = surfaces.get(s);
        if (owner && owner !== w.id) errors.push(`${where}: 표현 "${s}" 가 ${owner} 에도 등록됨 (forms 는 한 단어에만)`);
        surfaces.set(s, w.id);
      }
      dict.set(w.id, w);
      cleaned.push(cleanWord(r));
    });
  }
  let exam;
  if (!isObj2(data.exam)) errors.push("exam 은 시험 객체 { id, name, sources, index, examples, sentences, notes }");
  else {
    const e = data.exam;
    for (const k of Object.keys(data.exam)) if (!EXAM_KEYS.includes(k)) warns.push(`exam: 모르는 필드 "${k}" — 쓰이지 않습니다`);
    const before = errors.length;
    checkExam(e, dict, out, packLabels);
    if (!isObj2(e.index) || !Object.keys(e.index).length) errors.push("exam.index 가 비어 있음 — 문제에 나온 단어와 문제 파일별 횟수를 적어야 함");
    if (errors.length === before) {
      exam = {
        id: e.id,
        name: e.name,
        ...typeof e.order === "number" ? { order: e.order } : {},
        sources: e.sources.map((s) => ({ id: s.id, name: s.name, ...s.kind ? { kind: s.kind } : {} })),
        index: e.index,
        examples: e.examples ?? {},
        sentences: e.sentences ?? {},
        notes: e.notes ?? {}
      };
      softChecks(exam, dict, warns);
    }
  }
  if (errors.length || !exam) return { errors, warns };
  return {
    errors,
    warns,
    pack: { app: EXAMPACK_APP, kind: EXAMPACK_KIND, version: EXAMPACK_VERSION, builtAt: data.builtAt, exam, words: cleaned }
  };
}
function softChecks(exam, dict, warns) {
  const used = /* @__PURE__ */ new Set([...Object.keys(exam.index), ...Object.keys(exam.notes)]);
  for (const byWord of Object.values(exam.examples)) for (const id of Object.keys(byWord)) used.add(id);
  const unused = [...dict.keys()].filter((id) => !used.has(id));
  if (unused.length) warns.push(`시험에서 쓰이지 않는 단어 ${unused.length}개 (index·examples·notes 어디에도 없음): ${unused.slice(0, 10).join(", ")}${unused.length > 10 ? " …" : ""}`);
  const quiz = exam.sources.filter(isQuizSource);
  for (const s of quiz) if (!exam.sentences[s.id]?.length) warns.push(`exam.sentences.${s.id}: 문제 문장이 없음 — 예문이 없는 단어에 자동으로 붙일 문장이 없다`);
  const withExample = /* @__PURE__ */ new Set();
  const noKo = [];
  const notInSentences = [];
  for (const [src, byWord] of Object.entries(exam.examples)) {
    const sentences = new Set((exam.sentences[src] ?? []).map((x) => x.en));
    for (const [id, list] of Object.entries(byWord)) {
      withExample.add(id);
      const ns = list.map((x) => x.n).filter((n) => n !== void 0);
      if (new Set(ns).size !== ns.length) warns.push(`exam.examples.${src}.${id}: n(보여 줄 순서)이 겹침`);
      list.forEach((x, i) => {
        if (!x.ko) noKo.push(`${src}.${id}[${i}]`);
        if (sentences.size && !sentences.has(x.en)) notInSentences.push(`${src}.${id}[${i}]`);
      });
    }
  }
  if (noKo.length) warns.push(`해석(ko)이 없는 예문 ${noKo.length}개: ${noKo.slice(0, 5).join(", ")}${noKo.length > 5 ? " …" : ""}`);
  if (notInSentences.length) warns.push(`예문의 en 이 그 문제 파일의 sentences 에 없음 ${notInSentences.length}개 (문장을 그대로 옮겼는지 확인): ${notInSentences.slice(0, 5).join(", ")}${notInSentences.length > 5 ? " …" : ""}`);
  const noExample = Object.keys(exam.index).filter((id) => !withExample.has(id));
  if (noExample.length) warns.push(`예문이 없는 단어 ${noExample.length}개 (문장 색인에서 자동으로 찾아 보여 준다): ${noExample.slice(0, 10).join(", ")}${noExample.length > 10 ? " …" : ""}`);
  const missing = [];
  const different = [];
  for (const [id, bySrc] of Object.entries(exam.index)) {
    const w = dict.get(id);
    if (!w) continue;
    const re = new RegExp(wordRegex(w).source, "gi");
    for (const [src, n] of Object.entries(bySrc)) {
      const list = exam.sentences[src];
      if (!list?.length) continue;
      const counted = list.reduce((sum, x) => sum + (x.en.match(re)?.length ?? 0), 0);
      if (!counted) missing.push(`${id}@${src}`);
      else if (counted !== n) different.push(`${id}@${src} (적힌 값 ${n}, 센 값 ${counted})`);
    }
  }
  if (missing.length) warns.push(`횟수는 적혀 있는데 그 문제 파일의 문장에서 찾지 못한 단어 ${missing.length}개 (forms 에 변화형을 넣었는지 확인): ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? " …" : ""}`);
  if (different.length) warns.push(`횟수가 문장에서 센 값과 다른 항목 ${different.length}개: ${different.slice(0, 10).join(", ")}${different.length > 10 ? " …" : ""}`);
}

// scripts/docs/validate-exampack.entry.ts
function checkExamPack(data) {
  const { errors, warns, pack } = validateExamPack(data);
  if (!pack) return { ok: false, errors, warnings: warns };
  const examples = Object.values(pack.exam.examples).reduce((a, byWord) => a + Object.values(byWord).reduce((b, list) => b + list.length, 0), 0);
  const sentences = Object.values(pack.exam.sentences).reduce((a, list) => a + list.length, 0);
  return {
    ok: true,
    errors,
    warnings: warns,
    summary: { exam: pack.exam.id, name: pack.exam.name, sources: pack.exam.sources.length, words: pack.words.length, examples, sentences }
  };
}
async function main(argv) {
  const { readFileSync } = await import("node:fs");
  const json = argv.includes("--json");
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("사용법: node validate-exampack.mjs <파일.exampack.json> [--json]");
    return 2;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    if (json) console.log(JSON.stringify({ ok: false, errors: [`파일을 읽지 못함: ${e.message}`], warnings: [] }));
    else console.error(`ERROR  파일을 읽지 못함 (JSON 형식 오류일 수 있음): ${e.message}`);
    return 2;
  }
  const r = checkExamPack(data);
  if (json) console.log(JSON.stringify(r, null, 2));
  else {
    for (const w of r.warnings) console.log(`WARN   ${w}`);
    for (const e of r.errors) console.log(`ERROR  ${e}`);
    if (r.summary) console.log(`시험 ${r.summary.exam} (${r.summary.name}) — 문제 파일 ${r.summary.sources}개 · 단어 ${r.summary.words}개 · 예문 ${r.summary.examples}개 · 문장 ${r.summary.sentences}개`);
    console.log(`RESULT: ${r.ok ? "PASS" : "FAIL"} errors=${r.errors.length} warnings=${r.warnings.length} (시험 팩 형식 버전 ${EXAMPACK_VERSION})`);
  }
  return r.ok ? 0 : 1;
}
if (typeof process !== "undefined" && process.versions?.node && process.argv[1]) {
  const { realpathSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  let direct = false;
  try {
    direct = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
  }
  if (direct) process.exitCode = await main(process.argv.slice(2));
}
export {
  EXAMPACK_VERSION,
  checkExamPack,
  validateExamPack
};
