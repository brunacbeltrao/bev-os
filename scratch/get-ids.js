const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function run() {
  const { data: dirs } = await supabase.from('directorates').select('id, nome')
  console.log('Directorates:', dirs)
  const comercialId = dirs.find(d => d.nome.toLowerCase().includes('comercial')).id
  const gestaoId = dirs.find(d => d.nome.toLowerCase().includes('gestão')).id
  
  const { data: subs } = await supabase.from('subareas').select('id, nome, directorate_id')
  console.log('Subareas Comercial:', subs.filter(s => s.directorate_id === comercialId))
  console.log('Subareas Gestao:', subs.filter(s => s.directorate_id === gestaoId))
  
  const { data: rosterComercial } = await supabase.from('approved_roster').select('id, role, person_id, people(nome), subarea_id').eq('directorate_id', comercialId)
  console.log('Comercial Roster:', JSON.stringify(rosterComercial, null, 2))

  const { data: rosterGestao } = await supabase.from('approved_roster').select('id, role, person_id, people(nome), subarea_id').eq('directorate_id', gestaoId)
  console.log('Gestao Roster:', JSON.stringify(rosterGestao, null, 2))
}
run()
