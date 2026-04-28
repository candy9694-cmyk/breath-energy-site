# 呼吸的地方｜高質感品牌版能量決策網站

已整合你提供的品牌底版 `brand-bg.png`，並完成：

- 高質感首頁 Hero
- 手機版優化
- 感情 / 工作 / 財務入口
- 免費摘要
- 付費解鎖流程
- 會員 / 報告 / 訂單 / 解鎖碼資料表
- LINE 發碼接口
- 綠界 / 藍新 callback 預留接口

## 啟動

```bash
npm install
cp .env.example .env
npm start
```

開啟：

```text
http://localhost:3000
```

## Supabase

到 Supabase SQL Editor 執行：

```text
sql/schema.sql
```

再填入 `.env`：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## 正式上線前

1. 將模擬分數替換為你原本八字與六爻引擎
2. 綠界 callback 加上 CheckMacValue 驗證
3. 藍新 callback 加上 TradeInfo 解密與 TradeSha 驗證
4. 移除或保護 `/api/order/manual-paid`
5. 串 LINE Login 取得 line_user_id
