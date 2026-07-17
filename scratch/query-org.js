import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function test() {
  const { data: dirs } = await supabase.from('directorates').select('id, nome')
  console.log('Directorates:', dirs)
  const { data: subs } = await supabase.from('subareas').select('id, nome, directorate_id')
  console.log('Subareas:', subs)
}

test()
