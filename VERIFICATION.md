# Jin's Trading · 진스트레이딩 — 검증 기록

- 지표 계산·입력·설정 검증 테스트 28개 통과: Wilder RSI, 여섯 이동평균, 볼린저, MACD, ATR, 스토캐스틱, OBV·VWAP, 돈치안·켈트너, DMI·ADX, CCI·MFI·Williams %R·ROC·CMF, 가격 시간축 일치, 과거값 불변, 설정 이관·복원, 거래량 표기, 매물대 가치 영역 포함
- Vite 프로덕션 빌드 통과
- 미국주식·한국주식·코스닥·KOSPI 실제 일봉 API 정상 응답
- 미국·한국 거래대금 TOP100 API 각각 100종목 정상 응답
- Supabase RLS 트랜잭션 테스트: 본인 조회·수정 허용, 타인 조회·쓰기 및 소유자 변경 차단 확인
- RLS 테스트 데이터 전부 롤백
- Supabase 보안 advisor 경고 없음
- Vercel Node.js 24 / 서울 리전 배포 READY
- 공개 운영 주소 https://jins-trading.vercel.app 에서 HTTP 200 및 Jin's Trading · 진스트레이딩 페이지 제목 확인
- 배포된 /api/market에서 미국·한국·코스닥·KOSPI 일봉 및 양국 TOP100 조회 6개 모두 HTTP 200 확인

브라우저 도구가 제공되지 않아 데스크톱·모바일 실제 렌더링과 로그인 화면 조작은 검증하지 못했습니다. 웹 배포 후 별도 사용자 흐름 확인이 필요합니다.
