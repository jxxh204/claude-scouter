<p align="center">
  <img src="./assets/banner.png" alt="claude-scouter banner" width="100%"/>
</p>

<p align="center">
  <strong>Your project's power level... let me check.</strong><br/>
  <sub>Claude Code project bootstrapper that scans, detects, and powers up your dev setup.</sub>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#what-gets-deployed">What Gets Deployed</a> &middot;
  <a href="#commands">Commands</a> &middot;
  <a href="#merge-mode">Merge Mode</a> &middot;
  <a href="#skills">Skills</a>
</p>

---

## What is this?

**claude-scouter**는 Claude Code 프로젝트의 전투력을 측정하고, 부족한 부분을 자동으로 세팅해주는 CLI 도구입니다.

스카우터를 쓰면 상대의 전투력이 보이듯, `claude-scouter`는 프로젝트를 스캔해서:

- 프레임워크를 **감지**하고
- CLAUDE.md, skills, agents, hooks를 **배치**하고
- 기존 설정이 있으면 파괴하지 않고 **병합**합니다

> _"전투력이 9000 이상이라고...?!"_ — 사실 설정만 잘 해도 그렇습니다.

---

## Quick Start

```bash
npx claude-scouter init
```

대화형 셋업이 시작됩니다:

1. 프레임워크 감지 (Next.js, React, Python, Go 등)
2. PR/커밋/브랜치 컨벤션 설정
3. 스킬 선택
4. 파일 생성 (또는 기존 파일과 병합)

전부 기본값으로 쓰려면:

```bash
npx claude-scouter init -y
```

---

## What Gets Deployed

스카우터가 배치하는 전투 장비 목록:

| 파일 | 역할 | 전투력 기여도 |
|------|------|:---:|
| `CLAUDE.md` | 프로젝트 규칙, 워크플로우, 컨벤션 | +3000 |
| `.claude/settings.json` | 권한 허용/차단, 훅 설정 | +1500 |
| `.claude/skills/ultrawork.md` | 깊은 분석 기반 문제 해결 | +800 |
| `.claude/skills/verify.md` | 다단계 검증 프로토콜 | +700 |
| `.claude/skills/explore-first.md` | 코드 변경 전 탐색 우선 | +600 |
| `.claude/skills/deep-debug.md` | 체계적 디버깅 방법론 | +600 |
| `.claude/skills/code-review.md` | 독립적 코드 리뷰 체크리스트 | +500 |
| `.claude/skills/pr-create.md` | 컨벤션 준수 PR 자동 생성 | +400 |
| `.claude/skills/commit.md` | 커밋 규칙 강제 | +400 |
| `.claude/agents/reviewer.md` | 코드 리뷰 에이전트 | +300 |
| `.claude/agents/explorer.md` | 코드베이스 탐색 에이전트 | +200 |
| `.github/pull_request_template.md` | PR 템플릿 | +100 |
| `.claude-scouter.lock.json` | 버전/해시 추적 | — |

**합계: OVER 9000**

---

## Commands

### `init` — 스카우터 장착

```bash
npx claude-scouter init        # 대화형
npx claude-scouter init -y     # 기본값으로 즉시 장착
```

프로젝트를 스캔하고, 설정 파일을 생성합니다.
기존 Claude Code 설정이 있으면 [Merge Mode](#merge-mode)가 발동합니다.

### `update` — 전투력 갱신

```bash
npx claude-scouter update
```

생성된 파일을 최신 템플릿으로 업데이트합니다.
사용자가 직접 수정한 파일은 건드리지 않습니다.

### `doctor` — 전투력 측정

```bash
npx claude-scouter doctor
```

현재 프로젝트 설정의 건강 상태를 체크합니다.

```
  ✓ CLAUDE.md: CLAUDE.md exists
  ✓ Settings: .claude/settings.json is valid
  ✓ Lock file: .claude-scouter.lock.json exists
  ✓ Skill: ultrawork: ultrawork.md exists
  ⚠ Script: test: No "test" script in package.json
```

---

## Merge Mode

> 이미 전투 중인 전사의 장비를 부수지 않습니다.

기존에 CLAUDE.md나 `.claude/` 설정을 직접 만들어 쓰고 있는 프로젝트에서 `init`을 실행하면, 스카우터가 자동으로 감지합니다:

```
  ▲  Existing Claude Code settings detected:
    ✓ CLAUDE.md
    ✓ .claude/settings.json
    ! .claude/skills/commit.md (scouter name conflict)
    ✓ .claude/skills/my-custom.md (preserved)
```

그리고 3가지 전략을 제안합니다:

| 전략 | 동작 |
|------|------|
| **Merge** (추천) | 기존 내용 보존 + scouter 설정 추가 |
| **Overwrite** | 전부 새로 생성 |
| **Cancel** | 아무것도 안 함 |

### CLAUDE.md — Sentinel 병합

기존 내용은 그대로 두고, scouter 관리 영역만 추가/교체합니다:

```markdown
# My Custom Rules        ← 기존 내용 보존
...

<!-- claude-scouter:start -->
# Project Rules (scouter) ← 이 영역만 scouter가 관리
...
<!-- claude-scouter:end -->
```

`update` 시 sentinel 바깥은 절대 건드리지 않습니다.

### settings.json — Deep Merge

```
기존 permissions.allow + scouter allow → 합집합 (중복 제거)
기존 permissions.deny  + scouter deny  → 합집합
기존 hooks + scouter hooks → matcher 기준 병합 (기존 우선)
기존 커스텀 키 → 그대로 보존
```

### Skills/Agents — 충돌 확인

- 이름이 같은 파일 → "Keep yours / Use scouter's" 선택
- 사용자만의 커스텀 스킬 → 건드리지 않음

---

## Skills

스카우터가 배치하는 전투 기술:

| 스킬 | 설명 |
|------|------|
| `/ultrawork` | 깊은 분석 기반 문제 해결. 복잡한 문제에 체계적으로 접근 |
| `/verify` | typecheck + lint + test 다단계 검증 프로토콜 |
| `/explore-first` | 코드 수정 전 코드베이스 탐색 우선 |
| `/deep-debug` | 재현 → 격리 → 수정 → 검증 디버깅 방법론 |
| `/code-review` | 정확성, 보안, 품질 관점 코드 리뷰 |
| `/pr-create` | 프로젝트 컨벤션에 맞는 PR 자동 생성 |
| `/commit` | 커밋 규칙 강제 + 검증 |

---

## Development

```bash
npm install
npm run dev -- init        # init 실행
npm run dev -- doctor      # doctor 실행
npm run typecheck          # 타입 체크
npm run build              # 빌드
```

---

## License

MIT
