# 🔬 Claude Scouter

> Claude Code 사용량을 실시간으로 모니터링하는 데스크탑 위젯 앱

![Tauri](https://img.shields.io/badge/Tauri_v2-FFC131?style=flat&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)

화면 한 켠에 항상 띄워놓는 작은 위젯 형태의 Claude Code 사용량 모니터. 터미널을 열지 않아도 토큰 소비, 비용, 세션 리밋을 한눈에 확인할 수 있습니다.

> 💡 기존 CLI 버전은 [`legacy`](https://github.com/jxxh204/claude-scouter/tree/legacy) 브랜치에 보존되어 있습니다.

---

## ✨ 기능

- **🔄 실시간 모니터링** — `~/.claude/` 파일 변경 감지 (notify crate), 2초 디바운스
- **📊 토큰 사용량** — Input / Output / Cache Read / Cache Write 분리 표시
- **💰 비용 분석** — 모델별 가격 기반 실시간 비용 계산
- **🔥 번레이트** — 분당 토큰 소비량 + 리밋까지 남은 시간 예측
- **⚠️ 상태 알림** — OK (< 70%) → Warning (70-90%) → Critical (90%+) 색상 변화
- **📋 플랜 선택** — Pro (44K) / Max5 (88K) / Max20 (220K)
- **💬 세션 추적** — 세션별 토큰 / 메시지 수 / 비용 분리 표시
- **🖥️ 위젯 모드** — Always-on-top, 투명 배경, 커스텀 타이틀바 (드래그 이동)

---

## 🛠️ 기술 스택

| 레이어 | 기술 |
|--------|------|
| **프레임워크** | Tauri v2 |
| **프론트엔드** | React + TypeScript + Vite |
| **백엔드** | Rust |
| **파일 감시** | notify (inotify/FSEvents) |
| **타겟** | macOS (Apple Silicon + Intel) |

---

## 🚀 설치 & 실행

### Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js (v18+)
brew install node
```

### Development

```bash
git clone https://github.com/jxxh204/claude-scouter.git
cd claude-scouter
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

빌드 결과물은 `src-tauri/target/release/bundle/` 에 `.dmg` / `.app` 으로 생성됩니다.

---

## 📐 아키텍처

```
claude-scouter/
├── src/                    # React 프론트엔드
│   ├── App.tsx             # 메인 위젯 UI
│   ├── styles.css          # 다크 테마 스타일
│   └── main.tsx            # 엔트리포인트
├── src-tauri/              # Rust 백엔드
│   ├── src/
│   │   ├── main.rs         # Tauri 앱 + commands
│   │   └── monitor.rs      # 파일 감시 + 데이터 파싱
│   └── tauri.conf.json     # 창 설정 (360x520, always-on-top)
└── index.html
```

### 데이터 플로우

```
~/.claude/projects/**/*.jsonl
        │
        ▼  (notify: 파일 변경 감지)
   Rust monitor.rs
   ├─ JSONL 파싱
   ├─ 토큰 집계
   ├─ 비용 계산
   └─ 번레이트 예측
        │
        ▼  (Tauri event: "usage-updated")
   React App.tsx
   └─ 실시간 UI 업데이트
```

---

## 📊 지원 플랜

| 플랜 | 토큰 리밋 (5시간) | 대상 |
|------|-------------------|------|
| **Pro** | 44,000 | Claude Pro 구독 |
| **Max5** | 88,000 | Claude Max (5x) |
| **Max20** | 220,000 | Claude Max (20x) |

---

## 🗺️ 로드맵

- [ ] 시스템 트레이 / 메뉴바 앱 모드
- [ ] macOS 네이티브 알림 (리밋 임박 시)
- [ ] 사용량 히스토리 그래프
- [ ] 커스텀 플랜 리밋 설정
- [ ] 다중 프로젝트 필터링
- [ ] 테마 커스터마이징

---

## 📝 License

MIT
