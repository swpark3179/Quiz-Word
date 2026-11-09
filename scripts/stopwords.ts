/**
 * 단어장에서 뺄 단어 목록.
 * - FUNCTION_WORDS: 기능어 (관사·대명사·be/have/do·조동사·기본 전치사·접속사·의문사·수사 등)
 * - PROPER_TECH: 고유명사·제품명·기술 토큰 (소문자로 비교)
 * vocab/index.json 에 등록된 단어는 이 목록과 관계없이 항상 유지한다.
 */

export const FUNCTION_WORDS = new Set(
  `
a an the
i me my mine myself you your yours yourself yourselves he him his himself she her hers herself
it its itself we us our ours ourselves they them their theirs themselves
this that these those such
be am is are was were been being
have has had having
do does did doing done
will would shall should can could may might must ought
not no nor yes
and or but so if than then else because
of to in on at by for with from into about over under up down out off
as
what which who whom when where why how
there here
all any both each every many much more most some
other another
one two three four five six seven eight nine ten
very too also
s t d ll re ve m
etc e.g i.e vs
ok okay
`
    .split(/\s+/)
    .filter(Boolean),
);

export const PROPER_TECH = new Set(
  `
claude anthropic opus sonnet haiku
github gitlab git slack jira confluence notion google gmail microsoft azure aws amazon bedrock vertex openai
python javascript typescript node npm pnpm pip java golang rust ruby php sql postgres postgresql mysql sqlite redis
json jsonl yaml yml xml html css csv tsv pdf png jpg jpeg svg md markdown
url urls uri http https rest grpc rpc ssh tls ssl
sdk sdks cli mcp llm llms ai id ids uuid
ci cd pr prs qa ui ux os vm
pii hipaa gdpr sla
macos linux windows unix bash zsh powershell docker kubernetes
vscode jetbrains vim
fastapi django flask react nextjs vercel supabase
`
    .split(/\s+/)
    .filter(Boolean),
);
