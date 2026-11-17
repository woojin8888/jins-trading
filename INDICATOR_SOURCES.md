# TradingView 공식 지표 확인 및 구현 범위

2026-11-17 공식 문서를 확인하고, 현재 제공받는 실제 OHLCV로 계산 가능한 지표를 구현했습니다. TradingView 차트 서비스의 모든 지표·커뮤니티 스크립트를 실행하는 것은 아니며 데이터 공급처, 계산 시작점, 평활 초기값에 따라 수치가 달라질 수 있습니다.

| 공식 문서 | 이 사이트의 구현 |
| --- | --- |
| [Indicators list](https://www.tradingview.com/charting-library-docs/latest/ui_elements/indicators/Indicators-List/) | 지원 목록 선택에 참고. 사용자 지표 23개와 거래량·매물대·지수 대비 RS 3개 |
| [Moving Average Ribbon](https://www.tradingview.com/support/solutions/43000644913-moving-average-ribbon/) | 선별 종류·기간·가격 기준·색상 설정, 1~4px 두께. 최대 8개 |
| [Moving Averages](https://www.tradingview.com/support/solutions/43000502589-moving-averages/), [VWMA](https://www.tradingview.com/support/solutions/43000592293-volume-weighted-moving-average-vwma/) | SMA·EMA·WMA·RMA·VWMA·HMA. EMA·RMA는 SMA 초기값, HMA는 반기간 내림·제곱근 기간 반올림 사용 |
| [Visible Range Volume Profile](https://www.tradingview.com/support/solutions/43000703076-visible-range-volume-profile/) | 보이는 구간/최근 N봉 추정 매물대, 구간 수·색상·POC·가치 영역 설정. 현재 봉의 고저에 거래량을 배분하며 더 낮은 주기 데이터를 요청하는 공식 제품의 계산과는 차이 |
| [Volume profile basic concepts](https://www.tradingview.com/support/solutions/43000502040-volume-profile-indicators-basic-concepts/) | POC와 그 주변을 연속 포함하는 가치 영역을 추정. 설정 비율 이상이 될 때까지 인접 고거래량 구간을 선택 |
| [Donchian Channels](https://www.tradingview.com/support/solutions/43000502253-donchian-channels-dc/) | 기간 고가 최대·저가 최소 및 중간선 |
| [Keltner Channels](https://www.tradingview.com/support/solutions/43000502266-keltner-channels-kc/) | EMA 중심선 ± 사용자 ATR 기간·배수 |
| [Directional Movement](https://www.tradingview.com/support/solutions/43000502250-directional-movement-dmi/) | Wilder 평활 +DI·−DI·ADX, 각각 준비 기간 필요 |
| [CCI](https://www.tradingview.com/support/solutions/43000502001-commodity-channel-index-cci/) | Typical price와 평균 절대편차, 상수 0.015 |
| [MFI](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/) | 상승·하락 typical price의 거래량 가중 흐름 비율 |
| [CMF](https://www.tradingview.com/support/solutions/43000501974-chaikin-money-flow-cmf/) | 고저 범위 종가 위치×거래량 합 / 거래량 합 |

기존 RSI·MACD·ATR·볼린저·스토캐스틱·OBV·누적 VWAP에 Stochastic RSI·Williams %R·ROC도 추가했습니다. 실제 가격을 사용하는 전통 지표 공식으로 계산하며 투자 권고나 자동 주문을 생성하지 않습니다.

공급받지 않는 주문장, 체결별 가격·거래량, 매수/매도 체결 분류나 세션별 분봉 자료를 임의로 만들지 않습니다. 현재 매물대는 추정치로 표시하며 장중 실시간·세션별 실제 매물대와 구분합니다. 미너비니·VCP와 RS 백분위의 기존 정의는 README를 따릅니다.
