import React, { useState, useEffect } from 'react'
import loggedInContext from './loggedInContext'
import { HashRouter, Route, Switch } from 'react-router-dom'
import './scss/style.scss'
import 'devextreme/dist/css/dx.material.blue.light.css'
import { Auth } from 'aws-amplify'
//import 'devextreme/dist/css/dx.light.css'

// To use react's "context" we need to create a context object,
// Then wrap a suitable parent in a <ContextProvider> component,
// which passes down the context value, and a function to allow children to update it
// Child components then use the useContext() hook to access or change the context
// In this app, the context vale is a loggenIn state variable whose value is
// set in the login components, but can be read by any other component

const loading = (
  <div className="pt-3 text-center">
    <div className="sk-spinner sk-spinner-pulse"></div>
  </div>
)

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Pages
//const Register = React.lazy(() => import('./views/pages/register/Register'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

function App() {
  // changed to a functional component to enable use of hooks (bc)
  const [loggedIn, setLoggedIn] = useState({ username: false }) // when logged in this will have a value like "brendan"
  console.log('in App', loggedIn)

  useEffect(() => {
    const reviewAuthenticatedUser = async () => {
      const userAuth = await Auth.currentAuthenticatedUser()
      console.log('data', userAuth)
      if (userAuth) {
        setLoggedIn({
          username: userAuth.username,
          email: userAuth.attributes.email,
          schoolName: userAuth.attributes['custom:schoolName'],
        })
      }
    }
    reviewAuthenticatedUser()
  }, [])

  return (
    <loggedInContext.Provider value={{ loggedIn, setLoggedIn }}>
      <HashRouter>
        <React.Suspense fallback={loading}>
          <Switch>
            {/* <Route exact path="/login" name="Login Page" render={(props) => <Login {...props} />} /> */}
            {/* Uncomment if you want a Register form
              <Route
              exact
              path="/register"
              name="Register Page"
              render={(props) => <Register {...props} />}
            /> */}
            <Route exact path="/404" name="Page 404" render={(props) => <Page404 {...props} />} />
            <Route exact path="/500" name="Page 500" render={(props) => <Page500 {...props} />} />
            <Route path="/" name="Home" render={(props) => <DefaultLayout {...props} />} />
          </Switch>
        </React.Suspense>
      </HashRouter>
    </loggedInContext.Provider>
  )
}

export default App
