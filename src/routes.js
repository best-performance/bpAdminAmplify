import React from 'react'

const NewSchool = React.lazy(() => import('./views/wonde/NewSchool'))
const UpdateSchool = React.lazy(() => import('./views/wonde/UpdateSchool'))
const PatTest = React.lazy(() => import('./views/tests/PatTest'))
const NaplanTest = React.lazy(() => import('./views/tests/NaplanTest'))
const Query1 = React.lazy(() => import('./views/queries/Query1'))
const Query2 = React.lazy(() => import('./views/queries/Query2'))
const Query3 = React.lazy(() => import('./views/queries/Query3'))
const LandingPage = React.lazy(() => import('./views/landingPage/LandingPage'))
const Login = React.lazy(() => import('./views/pages/login/Login'))

const routes = [
  { path: '/Login', name: 'Login', component: Login },
  { path: '/wonde/newSchool', name: 'NewSchool', component: NewSchool },
  { path: '/wonde/updateSchool', name: 'UpdateSchool', component: UpdateSchool },
  { path: '/tests/patTest', name: 'PatTest', component: PatTest },
  { path: '/tests/naplanTest', name: 'NaplanTest', component: NaplanTest },
  { path: '/queries/query1', name: 'Query1', component: Query1 },
  { path: '/queries/query2', name: 'Query2', component: Query2 },
  { path: '/queries/query3', name: 'Query3', component: Query3 },
  { path: '/landingPage', name: 'LandingPage', component: LandingPage },
  { path: '/', name: 'LandingPage', component: LandingPage },
]

export default routes
