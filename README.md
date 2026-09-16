# 하루

TodoMate의 편안한 일일 계획 경험에서 영감을 받아 만든 개인용 플래너입니다. 브랜드와 에셋은 복제하지 않고, 날짜 중심의 빠른 할 일 관리 흐름을 독자적으로 구현했습니다.

## 실행

```bash
npm install
npm run dev
```

## 현재 기능

- 주간/월간 날짜 이동
- 카테고리별 할 일 목록
- 할 일 추가, 완료, 삭제
- 반응형 데스크톱/모바일 UI
- 브라우저 임시 저장

## Supabase 연결 준비

UI는 `TaskRepository` 인터페이스만 사용합니다. 이후 `src/data/taskRepository.ts`의 `LocalTaskRepository` 대신 Supabase 구현체를 주입하면 화면 코드를 바꾸지 않고 데이터베이스를 연결할 수 있습니다.

필요한 환경변수 이름은 `.env.example`에 준비되어 있습니다.
