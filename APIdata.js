//database 連結
//共用 CRUD（新增、讀取、更新、刪除）函式
//APIdata.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './APIconfig.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 新增資料
 * @param {string} table 資料表名稱
 * @param {object|array} data 單筆或多筆資料
 */
export async function createRecord(table, data) {
  const { data: inserted, error } = await supabase.from(table).insert(data);
  if (error) throw error;
  return inserted;
}

/**
 * 取得資料
 * @param {string} table 資料表名稱
 * @param {object} filter 過濾條件，例如 { user_id: 'xxx' }
 */
export async function readRecords(table, filter = {}, orderBy = { column: 'created_at', ascending: false }) {
  let query = supabase.from(table).select('*');
  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(key, value);
  }
  query = query.order(orderBy.column, { ascending: orderBy.ascending });
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * 編輯資料
 * @param {string} table 資料表名稱
 * @param {string} id 欲更新資料的唯一識別符
 * @param {object} newData 更新資料
 */
export async function updateRecord(table, id, newData) {
  const { data, error } = await supabase.from(table).update(newData).eq('id', id);
  if (error) throw error;
  return data;
}

/**
 * 刪除資料
 * @param {string} table 資料表名稱
 * @param {string} id 欲刪除資料的唯一識別符
 */
export async function deleteRecord(table, id) {
  const { data, error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return data;
}

