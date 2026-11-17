# Jin's Trading · 진스트레이딩 — 검증 기록

- 지표 계산·입력·설정 검증 테스트 60개 통과: Wilder RSI, 여섯 이동평균, 볼린저, MACD, ATR, 스토캐스틱, OBV·VWAP, 돈치안·켈트너, DMI·ADX, CCI·MFI·Williams %R·ROC·CMF, 가격 시간축 일치, 과거값 불변, 설정 이관·복원, 거래량 표기, 매물대 가치 영역 포함
- 새 목록: 미국·한국의 5가지 정렬과 페이지 추가 조회 API 확인. 한국 이름·코스닥 코드·우선주 코드 검증
- 그리기: 여섯 도구 저장/복원, 잘못된 문서 방어, 날짜-가격 좌표 왕복, 빈 차트 공간·주말·일/주/월봉 좌표 유지, 전체 이동 검증
- 로그인 유지: 복원 중 게스트 전환 방지, 오래된 초기 응답 무시, 일시 연결 오류 복구, 온라인·탭 복귀 재시도, 명시적 로그아웃 우선, 이벤트 해제 검증
- 설치된 Supabase SDK + 테스트 저장소·모의 Auth 응답으로 새 클라이언트 세션 복원, 만료 토큰 교체, 로그아웃 시 저장 세션 제거 확인 (실제 사용자 자격증명 미사용)
- 전체화면: 네이티브 진입/종료, 모바일 화면 채우기, 요청 실패 대체, Esc·Alt+Enter, 설정창 Esc 우선, 지연 응답 취소, 페이지 잠금·스크롤·포커스 복귀, 해제 처리, WebKit 경로 검증 (모의 DOM/API)
- Vite 프로덕션 빌드 통과
- 미국주식·한국주식·코스닥·KOSPI 실제 일봉 API 정상 응답
- 미국·한국 거래대금 TOP100 API 각각 100종목 정상 응답
- Supabase RLS 트랜잭션 테스트: 본인 조회·수정 허용, 타인 조회·쓰기 및 소유자 변경 차단 확인
- RLS 테스트 데이터 전부 롤백
- 이번 조회에서 RLS/DB advisor 경고 없음. Auth의 [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) 비활성 경고 1건은 로그인 유지와 무관하며 설정을 변경하지 않음
- Vercel Node.js 24 / 서울 리전 배포 READY
- 공개 운영 주소 https://jins-trading.vercel.app 에서 HTTP 200 및 Jin's Trading · 진스트레이딩 페이지 제목 확인
- 배포된 /api/market에서 미국·한국·코스닥·KOSPI 일봉 및 양국 TOP100 조회 6개 모두 HTTP 200 확인

브라우저 도구가 제공되지 않아 데스크톱·모바일 실제 렌더링과 로그인 화면 조작은 검증하지 못했습니다. 웹 배포 후 별도 사용자 흐름 확인이 필요합니다.
