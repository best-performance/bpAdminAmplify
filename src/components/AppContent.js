import React, { Suspense } from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

// routes config
import routes from '../routes'

const Login = React.lazy(() => import('../views/pages/login/Login'))

const userName = false

const AppContent = () => {
  return (
    <CContainer lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Switch>
          {routes.map((route, idx) => {
            if (!userName) {
              route.component = Login // redirect to <login> for all routes if we are not logged in
            }
            return (
              route.component && (
                <Route
                  key={idx}
                  path={route.path}
                  exact={route.exact}
                  name={route.name}
                  render={(props) => (
                    <>
                      <route.component {...props} />
                    </>
                  )}
                />
              )
            )
          })}
          <Redirect from="/" to="/landingPage" />
        </Switch>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
