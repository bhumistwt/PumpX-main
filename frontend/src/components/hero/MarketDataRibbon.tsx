import React from "react";

const STREAM_ITEMS = [
  "BTC↑ +2.31%",
  "ETH FLOW +18.2K",
  "PUMPX YES 62.4%",
  "VOL SPIKE x3.1",
  "RISK INDEX 41",
  "WHALE ALERT 847 ETH",
  "BASE TPS 118",
  "SENTIMENT +0.74",
  "MEAN REVERTION ON",
  "LP DEPTH +14.7%",
];

const MarketDataRibbon: React.FC = () => {
  const rows = [STREAM_ITEMS, [...STREAM_ITEMS].reverse()];

  return (
    <div className="market-ribbon-wrap" aria-hidden>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`market-ribbon-track ${rowIndex % 2 === 0 ? "market-ribbon-left" : "market-ribbon-right"}`}
        >
          {[...row, ...row].map((item, idx) => (
            <span className="market-ribbon-item" key={`${rowIndex}-${idx}`}>
              {item}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MarketDataRibbon;
