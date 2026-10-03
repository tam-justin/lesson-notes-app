import { Shell } from './components/Shell'
import { useRoute } from './lib/router'
import { Dashboard } from './pages/Dashboard'
import { LessonPage } from './pages/Lesson'
import { SettingsPage } from './pages/Settings'
import { StudentPage } from './pages/Student'
import { StudentsPage } from './pages/Students'

export default function App() {
  const path = useRoute()
  const [, section, id, sub] = path.split('/')
  let page = <Dashboard />
  if (section === 'students') page = id ? <StudentPage id={id} /> : <StudentsPage />
  else if (section === 'lessons' && id) page = <LessonPage key={id} id={id} view={sub === 'note' ? 'note' : 'capture'} />
  else if (section === 'settings') page = <SettingsPage />
  return <Shell path={path}>{page}</Shell>
}
