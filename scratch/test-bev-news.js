import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function test() {
  console.log('Testing getNewsFeed query...')
  const { data, error } = await supabase
    .from('news_posts')
    .select('*, autor:people!news_posts_autor_id_fkey(id, nome, foto_url), reactions:news_reactions(person_id), comments:news_comments(*, autor:people!news_comments_person_id_fkey(id, nome, foto_url))')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('ERROR in getNewsFeed:', error)
  } else {
    console.log('SUCCESS in getNewsFeed! Rows:', data.length)
  }
}

test()
