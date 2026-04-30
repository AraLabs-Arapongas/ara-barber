import { listAllUsers } from '@/lib/platform/users'
import { UsersTable } from './users-table'

export default async function UsersPage() {
  const users = await listAllUsers()
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="font-display text-[1.5rem] font-semibold text-fg">Users</h1>
      <UsersTable users={users} />
    </div>
  )
}
