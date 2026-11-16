# Jin's Trading · 진스트레이딩

흰색 배경의 미국·한국 주식 차트 워크스페이스입니다. 이 저장소와 Supabase 프로젝트는 기존 사이트에서 독립되어 있으며 기존 프로젝트의 코드·테이블·로그인 데이터를 변경하지 않습니다.

## 기능

- 미국장·한국장 종목 검색, 일·주·월 캔들, 확대·이동·크로스헤어, 기간 선택 및 차트 PNG 다운로드
- 20·50·150·200 이동평균, 거래량, 14일 Wilder ATR%
- 미너비니 8조건과 자료 부족 상태 표시
- 선택한 비교 지수 대비 RS 선차트, TOP100 유니버스 내 RS 백분위
- 표시 구간 거래량 프로파일 추정 및 POC
- 60거래일을 20일씩 나눈 VCP 수축 탐색
- 미국·한국 거래대금 TOP100 스크리너, 검색·조건 필터·정렬
- 관심종목·관심그룹·종목 메모. 미로그인 시 브라우저 저장, 로그인 시 Supabase 동기화
- 모바일 레이아웃, 키보드 접근 가능한 버튼·모달

## 로컬 실행

Node.js 24 LTS를 사용합니다.

```sh
npm ci
cp .env.example .env.local
# .env.local에 새 프로젝트의 URL과 publishable key 입력
npm run dev
```

```sh
npm test
npm run build
```

Vite 개발 서버에도 `/api/market`이 연결되어 있습니다. 배포에서는 동일 경로를 Vercel Node.js 함수가 제공합니다.

## Supabase

전용 프로젝트: `jins-trading` · 서울 (`ap-northeast-2`).

`supabase/schema.sql`은 새 프로젝트에만 적용합니다. 사용자 데이터 테이블은 `trading_watchlist`, `trading_notes`이며 사용자 ID를 포함한 기본키와 RLS 소유자 정책으로 격리합니다. `anon`에는 읽기·쓰기 권한을 부여하지 않습니다. 클라이언트에는 publishable key만 사용하며 service role 키는 사용하지 않습니다.

`src/public-config.json`에 이 프로젝트의 URL과 공개 publishable key가 들어 있어 바로 빌드할 수 있습니다. 이 키는 브라우저에 노출하도록 설계된 공개 키이며 DB 권한은 RLS로 제한합니다. 비밀 키나 service role 키는 포함하지 않습니다. 아래 환경변수를 설정하면 공개 기본값을 덮어쓸 수 있습니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

이메일·비밀번호 로그인을 사용합니다. 이메일 인증이 켜져 있으면 가입 확인 메일의 인증 후 사이트에서 로그인합니다. 필요 시 Supabase Authentication의 Site URL/Redirect URLs를 실제 배포 주소에 맞춥니다. 게스트 데이터는 로그인 시 자동 합치지 않으며 계정별 데이터를 분리합니다.

## 지표 정의와 데이터 범위

시세·일봉은 Yahoo Finance에서 조회하며 지연·누락·제공처 접근 제한이 발생할 수 있습니다. OHLC는 배당 보정 미적용입니다. 진행 중인 당일 봉은 바뀔 수 있습니다. 실시간 체결 데이터라고 표시하지 않습니다. 조회 실패 시 임의 시세를 생성하지 않습니다.

ATR%는 14일 Wilder ATR/종가×100입니다. 미너비니 기준은 종가>150·200일선, 150>200일선, 200일선 22거래일 상승, 50>150·200일선, 종가>50일선, 52주 저가 대비 +30%, 고가에서 25% 이내, RS≥70입니다. 52주 조건은 252개 이상 일봉이 있어야 확인합니다.

RS 백분위는 TradingView Stock Screener의 해당 시장 거래대금 상위 100개 개별주식의 1년 수익률로 계산한 자체 지표입니다. 전체 시장 백분위, IBD 공식 RS Rating 및 독점 지표가 아닙니다. TOP100 밖의 종목은 RS 조건을 미확인으로 표시합니다. RS 선차트는 공통 거래일의 종목 종가/선택 지수 종가를 첫 공통 거래일 기준 100으로 환산합니다.

거래량 프로파일은 표시 구간 각 캔들의 거래량을 고저 범위에 균등 배분한 추정치이며 가격별 실제 체결량이 아닙니다. VCP는 고정 세 구간의 가격 변동폭과 평균 거래량 감소를 비교하는 탐색 보조 지표이며 패턴을 확정하지 않습니다. 주·월봉 표시에서도 분석 카드는 일봉 기준입니다.

## 배포

GitHub 저장소명과 Vercel 프로젝트명은 `jins-trading`입니다. 희망 주소는 `https://jins-trading.vercel.app`이며 실제 할당 결과를 확인해야 합니다. 다른 프로젝트의 환경변수나 DB를 재사용하지 않습니다.

Vercel: Vite / build `npm run build` / output `dist` / Node.js 24. 새 Supabase 연결은 공개 기본 설정에 포함되어 있습니다. 별도 프로젝트로 변경할 때만 위 환경변수를 등록합니다. 개인용 Supabase 프로젝트의 무료 DB 한도는 500MB이며 이 앱은 시세 전체를 DB에 복제하지 않고 관심종목·메모만 저장합니다.

## 차트 라이선스

차트는 TradingView의 Apache-2.0 라이선스 [Lightweight Charts](https://github.com/tradingview/lightweight-charts)를 사용합니다. 라이브러리 기본 TradingView attribution을 유지하고 차트 아래에도 제공자 링크를 표시합니다. 이 사이트는 TradingView 공식 제품이 아닙니다.
