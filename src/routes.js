import React from 'react'

const NewSchool = React.lazy(() => import('./views/wonde/NewSchool'))
const UpdateSchool = React.lazy(() => import('./views/wonde/UpdateSchool'))
const PatTest = React.lazy(() => import('./views/tests/PatTest'))
const NaplanTest = React.lazy(() => import('./views/tests/NaplanTest'))
const Query1 = React.lazy(() => import('./views/queries/Query1'))
const Query2 = React.lazy(() => import('./views/queries/Query2'))
const Query3 = React.lazy(() => import('./views/queries/Query3'))
const LandingPage = React.lazy(() => import('./views/landingPage/LandingPage'))
const Upload = React.lazy(() => import('./views/school/Upload'))
const History = React.lazy(() => import('./views/school/History'))
const Users = React.lazy(() => import('./views/school/Users'))

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/wonde/newSchool', name: 'NewSchool', component: NewSchool },
  { path: '/wonde/updateSchool', name: 'UpdateSchool', component: UpdateSchool },
  { path: '/tests/patTest', name: 'PatTest', component: PatTest },
  { path: '/tests/naplanTest', name: 'NaplanTest', component: NaplanTest },
  { path: '/queries/query1', name: 'Query1', component: Query1 },
  { path: '/queries/query2', name: 'Query2', component: Query2 },
  { path: '/queries/query3', name: 'Query3', component: Query3 },
  { path: '/landingPage', name: 'LandingPage', component: LandingPage },
  { path: '/school/upload', name: 'Upload', component: Upload },
  { path: '/school/list', name: 'History', component: History },
  { path: '/school/users', name: 'Users', component: Users },
]

export default routes
