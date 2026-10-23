// Scenario estimator, not measured provider spend. Supply measured bitrate and current provider prices.
const inputs=['BITRATE_KBPS','RECORDED_MINUTES_PER_DEBATE','DEBATES_PER_MONTH','RETENTION_MONTHS','STORAGE_USD_PER_GB_MONTH','EGRESS_GB_PER_MONTH','EGRESS_USD_PER_GB','TRANSCRIPTION_USD_PER_MINUTE'];
const values={};
for(const key of inputs){const value=Number(process.env[key]);if(process.env[key]===undefined||!Number.isFinite(value)||value<0)throw new Error(`Set nonnegative numeric ${key}`);values[key]=value;}
const gbPerDebate=values.BITRATE_KBPS*1000/8*60*values.RECORDED_MINUTES_PER_DEBATE/1e9;
const storedGB=gbPerDebate*values.DEBATES_PER_MONTH*values.RETENTION_MONTHS;
console.log(JSON.stringify({kind:'scenario estimate; excludes compute, TURN traffic, requests, redundancy and taxes',gbPerDebate,storedGB,
 storageUSDPerMonth:storedGB*values.STORAGE_USD_PER_GB_MONTH,
 egressUSDPerMonth:values.EGRESS_GB_PER_MONTH*values.EGRESS_USD_PER_GB,
 transcriptionUSDPerMonth:values.RECORDED_MINUTES_PER_DEBATE*values.DEBATES_PER_MONTH*values.TRANSCRIPTION_USD_PER_MINUTE},null,2));
