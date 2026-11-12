import { describe, expect, it } from 'vitest';
import example from '../../../docs/example.exampack.json';
import { examPackFileName, mergeExamPack, packExam, parseExamPack, slugId, validateExamPack, type ExamPackFile } from '../exampack';
import { buildWordData, type ExamData } from '../exams';
import type { RawWord } from '../normalize';

/** 예시 팩을 복사해 한 군데를 고친다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function broken(change: (p: any) => void): unknown {
  const copy = JSON.parse(JSON.stringify(example));
  change(copy);
  return copy;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const word = (p: any, id: string) => p.words.find((w: any) => w.id === id);
const errorsOf = (data: unknown) => validateExamPack(data).errors.join('\n');
const PACK = validateExamPack(example).pack as ExamPackFile;

describe('시험 팩: 단어 id 규칙', () => {
  it('표제어를 소문자·하이픈으로', () => {
    expect(slugId('escalate')).toBe('escalate');
    expect(slugId('lay out')).toBe('lay-out');
    expect(slugId('SLA')).toBe('sla');
    expect(slugId("don't")).toBe('dont');
    expect(slugId('read-only')).toBe('read-only');
    expect(slugId('  Root  Cause ')).toBe('root-cause');
    expect(slugId('lost-in-the-middle')).toBe('lost-in-the-middle');
  });
  it('파일 이름', () => {
    expect(examPackFileName('my-exam')).toBe('my-exam.exampack.json');
  });
});

describe('시험 팩: 검사', () => {
  it('예시 파일은 오류가 없다', () => {
    const r = validateExamPack(example);
    expect(r.errors).toEqual([]);
    expect(r.pack?.exam.id).toBe('sample-exam');
    expect(r.pack?.words).toHaveLength(11);
    // $schema 같은 덧붙인 필드는 버리고 정해진 필드만 남긴다
    expect(Object.keys(r.pack!)).toEqual(['app', 'kind', 'version', 'builtAt', 'exam', 'words']);
    expect(parseExamPack(example)).toEqual(r.pack);
  });

  it('다른 종류의 파일은 무엇인지 알려 준다', () => {
    expect(errorsOf(null)).toContain('시험 팩이 아닙니다');
    expect(errorsOf([])).toContain('시험 팩이 아닙니다');
    expect(errorsOf({ app: 'quiz-word', kind: 'wordset', version: 2, words: [], exams: [] })).toContain('단어 세트 파일이에요');
    expect(errorsOf({ app: 'quiz-word', version: 1, cards: {}, settings: {} })).toContain('진행 기록 파일');
    expect(errorsOf(broken((p) => (p.app = 'other')))).toContain('app 은 "quiz-word"');
    expect(errorsOf(broken((p) => (p.kind = 'pack')))).toContain('kind 는 "exampack"');
    expect(errorsOf(broken((p) => (p.version = 2)))).toContain('버전 2');
    expect(errorsOf(broken((p) => delete p.version))).toContain('version 은 숫자 1');
    expect(errorsOf(broken((p) => delete p.builtAt))).toContain('builtAt');
    expect(errorsOf(broken((p) => (p.builtAt = '어제')))).toContain('builtAt');
  });

  const cases: [string, (p: any) => void, string][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['단어가 없음', (p) => (p.words = []), 'words 는 단어 항목의 배열'],
    ['id 에 대문자', (p) => (word(p, 'downtime').id = 'Downtime'), 'id 는 소문자·숫자·하이픈만'],
    ['id 가 표제어와 다름', (p) => (word(p, 'downtime').id = 'down-time'), 'id 는 "downtime" 여야 함'],
    ['필수 필드 없음', (p) => delete word(p, 'downtime').meaning, '필수 필드 "meaning" 없음'],
    ['level 없음', (p) => delete word(p, 'downtime').level, 'level(1~6) 없음'],
    ['level 범위 밖', (p) => (word(p, 'downtime').level = 7), 'level 은 1~6 의 정수'],
    ['level 이 문자열', (p) => (word(p, 'downtime').level = '5'), 'level 은 1~6 의 정수'],
    ['모르는 품사', (p) => (word(p, 'downtime').pos = ['noun']), '알 수 없는 품사 "noun"'],
    ['senses 의 모르는 품사', (p) => (word(p, 'downtime').senses[0].pos = '명'), 'senses 품사 "명"'],
    ['모르는 분류', (p) => (word(p, 'downtime').domain = '기타'), '알 수 없는 domain "기타"'],
    ['분류 없음', (p) => delete word(p, 'downtime').domain, 'domain 없음'],
    ['short 없음', (p) => delete word(p, 'downtime').short, 'short 없음'],
    ['senses 없음', (p) => delete word(p, 'team').senses, 'senses 없음'],
    ['senses 모양이 틀림', (p) => (word(p, 'downtime').senses = ['중단 시간']), 'senses 는 [{ pos, ko }] 배열'],
    ['같은 뜻이 두 번', (p) => word(p, 'team').senses.push({ pos: '명사', ko: '팀' }), 'senses 에 같은 뜻이 두 번'],
    ['2단계 이상인데 외우기 없음', (p) => delete word(p, 'downtime').memory, '2단계 이상인 단어에는 memory'],
    ['외우기에 장면도 연상도 없음', (p) => (word(p, 'downtime').memory = { roots: [{ part: 'down', ko: '아래' }] }), 'story(어원 장면)나 hook(발음 연상)'],
    ['외우기가 너무 김', (p) => (word(p, 'downtime').memory.story = '가'.repeat(81)), 'memory.story 가 김 (81자, 80자 이하)'],
    ['family 에 자기 자신', (p) => (word(p, 'downtime').memory.family = ['Downtime']), 'memory.family 에 자기 자신이 있음'],
    ['roots 모양이 틀림', (p) => (word(p, 'downtime').memory.roots = [{ part: 'down' }]), 'memory.roots 항목에 part·ko 가 다 있어야 함'],
    ['시험 전용 필드가 단어에', (p) => (word(p, 'downtime').tier = 'core'), '"tier" 는 사전에 적지 않는다'],
    ['단어가 두 번', (p) => p.words.push(word(p, 'team')), '같은 id 가 두 번 이상 있음'],
    ['변화형이 두 단어에', (p) => (word(p, 'downtime').forms = ['outage']), '표현 "outage" 가'],
    ['forms 모양이 틀림', (p) => (word(p, 'migrate').forms = 'migrated'), 'forms 는 문자열 배열'],
    ['시험 id 형식', (p) => (p.exam.id = 'Sample Exam'), '시험 id 는 소문자·숫자·하이픈만'],
    ['시험 이름 없음', (p) => (p.exam.name = ' '), 'exam: name 없음'],
    ['문제 파일 id 중복', (p) => p.exam.sources.push({ id: 'part1', name: '또 1회' }), '문제 파일 id 중복 "part1"'],
    ['문제 파일 이름 없음', (p) => delete p.exam.sources[0].name, '문제 파일 part1 에 name 없음'],
    ['index 의 단어가 words 에 없음', (p) => (p.exam.index.ghost = { part1: 1 }), 'exam.index: 사전에 없는 단어 "ghost"'],
    ['index 의 문제 파일이 sources 에 없음', (p) => (p.exam.index.team.part9 = 1), '문제 파일 목록에 없는 "part9"'],
    ['횟수가 0', (p) => (p.exam.index.team.part1 = 0), 'part1 의 횟수는 1 이상의 정수'],
    ['횟수가 소수', (p) => (p.exam.index.team.part1 = 1.5), 'part1 의 횟수는 1 이상의 정수'],
    ['index 가 비어 있음', (p) => (p.exam.index = {}), 'exam.index 가 비어 있음'],
    ['예문에 그 표기가 없음', (p) => (p.exam.examples.part1.downtime[0].surface = 'downtimes'), '예문에 "downtimes" 없음'],
    ['예문의 뜻이 senses 에 없음', (p) => (p.exam.examples.part1.downtime[0].sense = '중단 시간'), '문맥 뜻 "중단 시간" 가 senses 에 없음'],
    ['예문의 모르는 품사', (p) => (p.exam.examples.part1.downtime[0].pos = 'n'), 'exam.examples.part1 › downtime: 알 수 없는 품사 "n"'],
    ['예문에 필드 없음', (p) => delete p.exam.examples.part1.downtime[0].en, '예문에 en·surface·pos·sense 가 다 있어야 함'],
    ['예문의 문제 번호가 음수', (p) => (p.exam.examples.part1.downtime[0].q = -1), 'q 는 0 이상의 정수'],
    ['예문의 문제 파일이 sources 에 없음', (p) => (p.exam.examples.part3 = { team: [] }), 'exam.examples.part3: sources 에 없는 문제 파일'],
    ['예문의 단어가 words 에 없음', (p) => (p.exam.examples.part1.ghost = []), 'exam.examples.part1: 사전에 없는 단어 "ghost"'],
    ['문장 모양이 틀림', (p) => (p.exam.sentences.part1 = ['A sentence.']), 'exam.sentences.part1: [{ q, en, ko? }] 형식이 아님'],
    ['문장의 문제 파일이 sources 에 없음', (p) => (p.exam.sentences.part3 = []), 'exam.sentences.part3: 문제 파일 목록에 없는 파일'],
    ['노트의 단어가 words 에 없음', (p) => (p.exam.notes.ghost = '노트'), 'exam.notes: 사전에 없는 단어 "ghost"'],
    ['노트가 문자열이 아님', (p) => (p.exam.notes.outage = ['노트']), 'exam.notes › outage: 노트는 문자열'],
    ['시험이 없음', (p) => delete p.exam, 'exam 은 시험 객체'],
  ];
  it.each(cases)('거부: %s', (_name, change, message) => {
    const r = validateExamPack(broken(change));
    expect(r.errors.join('\n')).toContain(message);
    expect(r.pack).toBeUndefined();
  });

  it('불러올 수는 있지만 확인이 필요한 것은 경고로 알린다', () => {
    const warns = (change: (p: any) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const r = validateExamPack(broken(change));
      expect(r.errors).toEqual([]);
      return r.warns.join('\n');
    };
    expect(warns((p) => delete p.exam.examples.part1.downtime[0].ko)).toContain('해석(ko)이 없는 예문 1개: part1.downtime[0]');
    expect(
      warns((p) => {
        delete p.exam.index.team;
        delete p.exam.examples.part1.team;
      }),
    ).toContain('시험에서 쓰이지 않는 단어 1개');
    expect(warns((p) => delete p.exam.examples.part1.team)).toContain('예문이 없는 단어 1개 (문장 색인에서 자동으로 찾아 보여 준다): team');
    expect(warns((p) => (p.exam.index.outage.part1 = 5))).toContain('횟수가 문장에서 센 값과 다른 항목 1개: outage@part1 (적힌 값 5, 센 값 2)');
    expect(warns((p) => (word(p, 'mitigate').forms = []))).not.toContain('찾지 못한 단어');
    expect(warns((p) => (p.exam.index.robust.part1 = 1))).toContain('찾지 못한 단어 1개 (forms 에 변화형을 넣었는지 확인): robust@part1');
    expect(warns((p) => (p.exam.examples.part1.downtime[0].en = 'There was no downtime.'))).toContain('sentences 에 없음 1개');
    expect(warns((p) => delete p.exam.sentences.part2)).toContain('exam.sentences.part2: 문제 문장이 없음');
    expect(warns((p) => (p.extra = 1))).toContain('모르는 필드 "extra"');
    expect(warns((p) => (word(p, 'team').short = 'team 팀'))).toContain('short 에 영어가 있음');
  });

  it('앱에서 읽을 때는 앞의 오류 몇 개를 메시지로 던진다', () => {
    expect(() => parseExamPack(broken((p) => (p.exam.id = 'X')))).toThrow('시험 id 는 소문자·숫자·하이픈만');
    const many = broken((p) => p.words.forEach((w: { level?: number }) => delete w.level));
    expect(() => parseExamPack(many)).toThrow('… 오류 6개 더');
  });
});

describe('시험 팩: 지금의 사전·시험 위에 얹기', () => {
  // 사전에 이미 있는 단어들 — 팩과는 뜻을 조금 다르게 적었다
  const OUTAGE: RawWord = { id: 'outage', word: 'outage', level: 5, pos: ['명사'], meaning: '장애', short: '장애', senses: [{ pos: '명사', ko: '(서비스·시스템) 장애, 일시 중단' }, { pos: '명사', ko: '정전' }], domain: '오류·실패·위험', memory: { story: '사전에 있던 외우기 → 장애' } };
  const MIGRATE: RawWord = { id: 'migrate', word: 'migrate', level: 4, pos: ['동사'], meaning: '이주하다', short: '이주하다', senses: [{ pos: '동사', ko: '(사람·동물이) 이주하다' }], forms: ['migrates'], domain: '이동·전달' };
  // 팩의 migrate 가 변화형으로 적은 migration 이 사전에는 따로 있는 단어다
  const MIGRATION: RawWord = { id: 'migration', word: 'migration', level: 5, pos: ['명사'], meaning: '이전', short: '이전', senses: [{ pos: '명사', ko: '이전' }], domain: '이동·전달' };
  // 표제어는 같은데 id 가 다른 단어
  const RISK: RawWord = { id: 'risk-2', word: 'Risk', level: 3, pos: ['명사'], meaning: '위험', short: '위험', senses: [{ pos: '명사', ko: '위험(성), 리스크' }], domain: '오류·실패·위험' };
  // 팩의 표제어 mitigate 를 변화형으로 갖고 있는 단어
  const MITIGATION: RawWord = { id: 'mitigation', word: 'mitigation', level: 6, pos: ['명사'], meaning: '완화(책)', short: '완화(책)', senses: [{ pos: '명사', ko: '완화(책)' }], forms: ['mitigate', 'mitigated'], domain: '오류·실패·위험' };
  const OTHER: ExamData = { id: 'other', name: '다른 시험', sources: [{ id: 'set1', name: '1회' }], index: { outage: { set1: 3 } }, examples: {}, sentences: {}, notes: {} };
  const base = { words: [MIGRATE, MIGRATION, MITIGATION, OUTAGE, RISK], exams: [OTHER] };
  const snapshot = JSON.stringify(base);
  const merged = mergeExamPack(base, PACK);
  const get = (id: string) => merged.words.find((w) => w.id === id)!;
  const exam = merged.exams.find((e) => e.id === 'sample-exam')!;

  it('있던 단어는 그대로 두고, 없는 단어만 넣는다', () => {
    expect(merged.report.keptWords.sort()).toEqual(['migrate', 'mitigation', 'outage', 'risk-2']);
    expect(merged.report.addedWords).toEqual(['downtime', 'fallback', 'legacy', 'replicate', 'robust', 'spike', 'team']);
    expect(merged.words).toHaveLength(12);
    // 단계·뜻·외우기는 사전의 것
    expect(get('outage')).toEqual(OUTAGE);
    expect(get('risk-2')).toEqual(RISK);
    expect(get('migrate').level).toBe(4);
    // 새 단어는 팩에 적힌 그대로
    expect(get('downtime')).toEqual(PACK.words.find((w) => w.id === 'downtime'));
    expect(Object.keys(get('replicate'))).toEqual(['id', 'word', 'level', 'pos', 'ipa', 'meaning', 'short', 'senses', 'forms', 'synonyms', 'domain', 'memory']);
  });

  it('넘겨받은 사전·시험은 바꾸지 않는다', () => {
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('팩의 단어 id 를 사전의 id 로 맞춘다 (표제어가 같으면 같은 단어)', () => {
    expect(exam.index['risk-2']).toEqual({ part1: 1, part2: 1 });
    expect(exam.index.risk).toBeUndefined();
    expect(Object.keys(exam.examples.part1)).toContain('risk-2');
  });

  it('팩의 표제어가 사전에서는 다른 단어의 변화형이면 그 단어로 본다 (같은 표기가 두 단어에 생기지 않게)', () => {
    expect(merged.words.some((w) => w.id === 'mitigate')).toBe(false);
    expect(exam.index.mitigation).toEqual({ part1: 1, part2: 1 });
    expect(exam.examples.part1.mitigation[0]).toMatchObject({ surface: 'mitigate', sense: '(위험·피해를) 줄이다, 완화하다' });
    // 사전의 뜻(명사 "완화(책)")과는 다른 품사의 뜻이라 덧붙는다
    expect(get('mitigation').senses).toEqual([{ pos: '명사', ko: '완화(책)' }, { pos: '동사', ko: '(위험·피해를) 줄이다, 완화하다' }]);
    expect(get('mitigation').forms).toEqual(['mitigate', 'mitigated', 'mitigating']);
    // 표기가 겹치지 않는다
    const seen = new Map<string, string>();
    for (const w of merged.words) {
      for (const x of [w.word!, ...(w.forms ?? [])].map((v) => v.toLowerCase())) {
        expect(seen.get(x) ?? w.id, x).toBe(w.id);
        seen.set(x, w.id!);
      }
    }
  });

  it('예문의 뜻: 사전에 같은 뜻이 있으면 그 뜻에 맞추고, 없을 때만 덧붙인다', () => {
    // 괄호 보충만 다른 뜻 → 사전의 뜻으로
    expect(exam.examples.part1.outage[0].sense).toBe('(서비스·시스템) 장애, 일시 중단');
    expect(exam.examples.part1['risk-2'][0].sense).toBe('위험(성), 리스크');
    // 사전에 없는 뜻 → 덧붙임
    expect(merged.report.addedSenses).toEqual([
      { id: 'migrate', ko: '(데이터·시스템을) 옮기다, 이전하다' },
      { id: 'migrate', ko: '(migration) 이전 작업' },
      { id: 'mitigation', ko: '(위험·피해를) 줄이다, 완화하다' },
    ]);
    expect(get('migrate').senses!.map((s) => s.ko)).toEqual(['(사람·동물이) 이주하다', '(데이터·시스템을) 옮기다, 이전하다', '(migration) 이전 작업']);
  });

  it('변화형: 다른 단어의 표기가 아닌 것만 덧붙인다', () => {
    expect(get('migrate').forms).toEqual(['migrates', 'migrated', 'migrating']);
  });

  it('시험은 추가하고, 다른 시험은 그대로 둔다', () => {
    expect(merged.exams.map((e) => e.id)).toEqual(['other', 'sample-exam']);
    expect(merged.exams[0]).toBe(OTHER);
    expect(merged.report).toMatchObject({ examId: 'sample-exam', examName: '샘플 시험', replacedExam: false, examples: 15, sources: 2 });
  });

  it('같은 id 의 시험이 있으면 그 시험만 바꾼다 (다시 불러와도 더 늘지 않는다)', () => {
    const again = mergeExamPack(merged, PACK);
    expect(again.report.replacedExam).toBe(true);
    expect(again.report.addedWords).toEqual([]);
    expect(again.report.addedSenses).toEqual([]);
    expect(again.exams.map((e) => e.id)).toEqual(['other', 'sample-exam']);
    expect(again.words).toEqual(merged.words);
    expect(again.exams[1]).toEqual(exam);
  });

  it('합친 결과를 앱이 읽으면 시험별 횟수·예문이 나온다', () => {
    const data = buildWordData(merged.words, merged.exams);
    const outage = data.WORD_BY_ID.get('outage')!;
    expect(outage.occ).toEqual({ other: { set1: 3 }, 'sample-exam': { part1: 2, part2: 1 } });
    expect(data.contextsOf(outage, 4, { cat: 'sample-exam', file: 'part2' }).map((c) => `${c.src}#${c.q}`)).toEqual(['part2#1', 'part1#2']);
    // 예문을 적지 않은 단어는 그 시험의 문장에서 자동으로 찾는다 (fallback 은 2회에만 예문이 있다)
    expect(data.corpusExamples(data.WORD_BY_ID.get('team')!, 4, { cat: 'sample-exam' }).map((c) => [c.src, c.auto])).toEqual([['part2', true]]);
    expect(data.WORD_BY_ID.get('outage')!.notes).toEqual([{ cat: 'sample-exam', md: PACK.exam.notes.outage }]);
  });
});

describe('시험 팩: 시험 하나를 팩으로 내보내기', () => {
  it('빈 사전에 얹었다가 다시 팩으로 만들면 원래와 같다', () => {
    const { words, exams, report } = mergeExamPack({ words: [], exams: [] }, PACK);
    expect(report.addedWords).toHaveLength(11);
    expect(packExam(words, exams[0], PACK.builtAt)).toEqual(PACK);
  });
  it('그 시험이 가리키는 단어만 담는다', () => {
    const extra: RawWord = { id: 'unused', word: 'unused', level: 1, pos: ['형용사'], meaning: '안 쓰는' };
    const pack = packExam([extra, ...PACK.words], PACK.exam, PACK.builtAt);
    expect(pack.words.map((w) => w.id)).toEqual(PACK.words.map((w) => w.id));
    expect(validateExamPack(pack).errors).toEqual([]);
  });
});
