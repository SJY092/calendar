/**
 * 新的 AI 匹配邏輯：時間/性別為硬性條件，距離/偏好為評分標準。
 * 採用 TypeScript 結構，可輕鬆整合到 Deno, Node.js 或 Edge Function。
 */

// ========================
// 🧮 型別定義 (與原始碼相同)
// ========================
interface Location {
  lat: number;
  lng: number;
}

interface TimeSlots {
  [day: string]: string[];
}

// interface Preferences {     //確認資料表名稱
//   language?: string[];  //經緯度(資料形式更改為location)
//   activity?: string[];
//   //   gender_preference?: string;
//   gender?: string; // 假設志工與長者資料中都有性別欄位
//   [key: string]: any;
// }

interface Elder {     //長者資料表
  id: string;
  gender: string; // 長者的性別
  location: Location;
  preferences_tags: string[];
//   preferences: Preferences;
}

interface Volunteer {     //志工資料表
  id: string;
  gender: string; // 志工的性別
  location: Location;
  available_time: TimeSlots;
  personality: string[];  //志工特質欄位
  visit_type: string; // 志工陪同形式欄位
//   preferences: Preferences;
}

interface appointment {      //志工預約資料表
    // older_id: string;
    // volunteer_id: string;
    appointment_time: TimeSlots;   //長者需要預約的時間
    visit_type: string; // in-person or remote  長者的陪同形式
}

// ========================
// 📏 工具函數 (沿用/修改)
// ========================

// 1. 計算地點距離 (Haversine formula) - 不變
function getDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // 地球半徑 (km)
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLon = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((loc1.lat * Math.PI) / 180) *
      Math.cos((loc2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 回傳公里數
}

// 2. 檢查時間是否有重疊 (新的硬性條件檢查)
function hasTimeOverlap(elderTimes: TimeSlots, volunteerTimes: TimeSlots): boolean {
  for (const day in elderTimes) {
    const elderSlots = elderTimes[day] || [];
    const volunteerSlots = volunteerTimes[day] || [];
    
    // 只要有一個時段重疊，即符合時間要求
    for (const slot of elderSlots) {
      if (volunteerSlots.includes(slot)) {
        return true;
      }
    }
  }
  return false;
}

// 3. 檢查性別是否符合 (新的硬性條件檢查)
function isGenderMatch(elder: Elder, volunteer: Volunteer): boolean {
  const elderGender = elder.gender?.toLowerCase();
  const volunteerGender = volunteer.gender?.toLowerCase();
  
  // 檢查長者對志工的性別要求
  if (elderGender === 'male' && volunteerGender !== 'male') return false;
  if (elderGender === 'female' && volunteerGender !== 'female') return false;

  // 假設志工沒有對長者的性別要求 (若有，需在此加入檢查)
  return true;
}

// //檢查陪同形式是否符合   !!需要檢查資料形式!!
function isVisitTypeMatch( appointment: any, Volunteer: any): boolean {
  const elderVisitType = appointment.visit_type?.toLowerCase();
  const volunteerVisitType = Volunteer.visit_type?.toLowerCase();

  // 檢查志工的陪同形式與長者的需求  
  if (elderVisitType === '家中' && volunteerVisitType !== '家中') return false;
  if (volunteerVisitType === '醫院'  && elderVisitType !=='醫院') return false;
  
 
  return true;
}

// 4. 特質匹配分數 (沿用原 preferenceScore，現命名為 traitScore)
function traitScore(elder: Elder, volunteer: Volunteer): number {
  const elderPrefs = elder.preferences_tags || [];
  const volunteerPrefs = volunteer.personality || [];

  if (!elderPrefs || !volunteerPrefs) return 0;
  
  let match = 0;
  let totalCriteria = 0; // 只計算用於評分的特質 (排除 gender_preference)

  for (const key in elderPrefs) {
    if (key === 'gender_preference' || key === 'gender' || key === 'location') continue; // 排除硬性條件或非偏好欄位

    const eVal = elderPrefs[key];
    const vVal = volunteerPrefs[key];
    totalCriteria++;

    if (Array.isArray(eVal) && Array.isArray(vVal)) {
      // 陣列匹配 (如：語言、活動)
      const common = eVal.filter((v) => vVal.includes(v));
      match += common.length / Math.max(eVal.length, 1);
    } else if (eVal === vVal) {
      // 純值匹配 (如：特定興趣標籤)
      match += 1;
    }
  }

  // 避免分母為零
  return totalCriteria > 0 ? match / totalCriteria : 0;
}


// ========================
// 🧠 主匹配函數
// ========================

// 權重設定
const WEIGHTS = {
  DISTANCE: 0.4, // 地點距離 (40%)
  TRAIT: 0.6,    // 特質偏好 (60%)
};
const MAX_MATCHES = 5; // 顯示五名志工

function matchElderToVolunteers(appointment:any,elder:any, allVolunteers: any) {
  const matches = [];

  for (const volunteer of allVolunteers) {
    // ⚠️ 第一步：硬性條件檢查 ⚠️
    const timeOK = hasTimeOverlap(appointment.appointment_time, volunteer.available_time);
    const genderOK = isGenderMatch(elder, volunteer);

    if (!timeOK || !genderOK) {
      continue; // 只要有一個條件不符，立刻跳過此志工
    }

    // ✅ 第二步：計算評分 ✅

    // 1. 地點距離分數（越近越高，10km 以內滿分）
    const distanceKm = getDistance(elder.location, volunteer.location);
    // 假設 10km 內滿分 (1.0)， > 10km 遞減，20km 歸零
    const distanceScore = Math.max(0, 1 - distanceKm / 20); // 調整分母，讓分數在更大的範圍內遞減

    // 2. 特質匹配分數
    const traitScoreValue = traitScore(elder, volunteer);
    
    // 3. 陪同形式匹配
    const visitTypeOK = isVisitTypeMatch(appointment, volunteer);
    if (!visitTypeOK) continue;


    // 4. 綜合權重分數：距離 40%、特質 60%
    const totalScore =
      (distanceScore * WEIGHTS.DISTANCE + traitScoreValue * WEIGHTS.TRAIT) * 100;

    matches.push({
      elder_id: elder.id,
      volunteer_id: volunteer.id,
      score: Math.round(totalScore),
      distance_km: distanceKm.toFixed(2),
    });
  }

  // 排序取前 5 名
  const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, MAX_MATCHES);

  return { elder_id: elder.id, matches: topMatches };
}


