# 🔬 Claude Scouter (클로드 스카우터)

> Claude Code 사용량을 실시간으로 모니터링하는 데스크탑 위젯 앱

![Tauri](https://img.shields.io/badge/Tauri_v2-FFC131?style=flat&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)

화면 한 켠에 항상 띄워놓는 작은 위젯. 터미널 없이 토큰 소비, 비용, 세션 리밋을 한눈에.

> 💡 기존 CLI 버전은 [`legacy`](https://github.com/jxxh204/claude-scouter/tree/legacy) 브랜치에 보존되어 있습니다.

---

## ✨ 기능

### 실시간 모니터링
- 🔄 `~/.claude/` 파일 변경 감지 (Rust notify crate)
- 📊 Input / Output / Cache Read / Cache Write 토큰 분리 표시
- 💰 모델별 가격 기반 실시간 비용 계산
- 🔥 분당 번레이트 + 리밋까지 남은 시간 예측
- ⏰ 5시간 롤링 윈도우 필터링 + 리셋 카운트다운

### 알림 & 상태
- ⚠️ 70% 도달 시 macOS 네이티브 경고 알림
- 🚨 90% 도달 시 Critical 알림
- 🟢🟡🔴 상태 인디케이터 (OK / Warning / Critical)

### 프로젝트 & 세션
- 📁 프로젝트별 사용량 분리 + 필터링
- 💬 세션별 토큰 / 메시지 / 비용 추적
- 📈 시간별 사용량 미니 그래프

### 데스크탑 위젯
- 🖥️ macOS 메뉴바 트레이 아이콘 (클릭으로 토글)
- 📌 Always-on-top 모드
- 🎨 다크 테마, 투명 배경, 커스텀 타이틀바
- 🖱️ 드래그로 위치 이동

### 플랜 & 설정
- 📋 Pro (44K) / Max5 (88K) / Max20 (220K) / Custom
- 🎯 커스텀 토큰 리밋 직접 입력

---

## 🛠️ 기술 스택

| 레이어 | 기술 |
|--------|------|
| **프레임워크** | Tauri v2 |
| **프론트엔드** | React + TypeScript + Vite |
| **백엔드** | Rust |
| **파일 감시** | notify (FSEvents on macOS) |
| **알림** | tauri-plugin-notification |
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

> ⏳ 첫 빌드 시 Rust crate 컴파일로 5-10분 소요

### Build (.app / .dmg)

```bash
npm run tauri build
```

빌드 결과물: `src-tauri/target/release/bundle/`

---

## 📐 아키텍처

```
claude-scouter/
├── src/                    # React 프론트엔드
│   ├── App.tsx             # 메인 위젯 UI (탭: Overview/Projects/Sessions)
│   ├── styles.css          # 다크 테마 스타일
│   └── main.tsx            # 엔트리포인트
├── src-tauri/              # Rust 백엔드
│   ├── src/
│   │   ├── main.rs         # Tauri 앱 + tray + commands
│   │   └── monitor.rs      # 파일 감시 + 파싱 + 알림
│   ├── icons/              # 앱 아이콘 + 트레이 템플릿
│   └── tauri.conf.json     # 창 설정 (360x620)
└── index.html
```

### 데이터 플로우

```
~/.claude/projects/**/*.jsonl
        │
        ▼  (notify: FSEvents)
   Rust monitor.rs
   ├─ 5시간 윈도우 필터링
   ├─ 토큰/비용/번레이트 계산
   ├─ 프로젝트별/세션별 집계
   ├─ 시간별 버킷팅
   └─ 70%/90% 알림 트리거
        │
        ▼  (Tauri event: "usage-updated")
   React App.tsx
   └─ 실시간 UI 업데이트
```

---

## 📊 지원 플랜

| 플랜 | 토큰 리밋 (5시간) | 비고 |
|------|-------------------|------|
| **Pro** | 44,000 | Claude Pro |
| **Max5** | 88,000 | Claude Max 5x |
| **Max20** | 220,000 | Claude Max 20x |
| **Custom** | 직접 입력 | 원하는 값 설정 |

---

## 📝 License

MIT
