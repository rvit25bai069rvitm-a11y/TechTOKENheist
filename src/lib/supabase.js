import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const missingSupabaseConfig = !supabaseUrl || !supabaseKey

const emptyResponse = { data: null, error: null, count: null }
const emptyListResponse = { data: [], error: null, count: 0 }

const createNoopQuery = () => {
  const query = {
    select: () => query,
    insert: () => query,
    update: () => query,
    delete: () => query,
    eq: () => query,
    ilike: () => query,
    limit: () => query,
    order: () => query,
    lte: () => query,
    neq: () => query,
    in: () => query,
    or: () => query,
    maybeSingle: () => Promise.resolve(emptyResponse),
    single: () => Promise.resolve(emptyResponse),
    then: (resolve, reject) => Promise.resolve(emptyListResponse).then(resolve, reject),
    catch: (reject) => Promise.resolve(emptyListResponse).catch(reject),
    finally: (handler) => Promise.resolve(emptyListResponse).finally(handler),
  }

  return query
}

const createNoopSupabaseClient = () => ({
  from: () => createNoopQuery(),
  channel: () => ({
    on() {
      return this
    },
    subscribe() {
      return this
    },
    unsubscribe() {
      return Promise.resolve()
    },
  }),
})

if (missingSupabaseConfig) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set in .env; using local no-op Supabase client.')
}

export const supabase = missingSupabaseConfig
  ? createNoopSupabaseClient()
  : createClient(supabaseUrl, supabaseKey)

export default supabase
