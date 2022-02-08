import React, { useState, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import { Auth } from 'aws-amplify'

const Login = () => {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')

  // We need to be able to set the logged in status from <Login>
  const { setLoggedIn } = useContext(loggedInContext)

  // console.log(process.env.REACT_APP_ENDPOINT)
  // console.log(process.env.REACT_APP_REGION)
  // console.log(process.env.REACT_APP_USER_POOL_ID)
  // console.log(process.env.REACT_APP_USER_POOL_CLIENT_ID)

  async function handleLogin() {
    try {
      console.log(`username: ${userName}, password ${password}`)
      let user = await Auth.signIn(userName, password)
      //const attributes = await Auth.userAttributes(user)
      console.log('signIn user', user)
      setLoggedIn({
        username: user.username,
        email: user.attributes.email,
      })
    } catch (err) {
      console.log(err)
    }
  }

  async function handleLogout() {
    try {
      await Auth.signOut()
      setLoggedIn({
        username: false,
      })
    } catch (err) {
      console.log('Logging out error', err)
    }
  }

  // Test function to create a new user
  async function handleRegister() {
    const username = 'testUser3'
    const password = 'testUser#3'
    const nickname = 'nickname barney'
    const email = 'brendan@bcperth.com'
    let user = {}
    try {
      user = await Auth.signUp({
        username,
        password,
        attributes: {
          email,
          nickname,
        },
      })
      console.log('User signed registered', user)
    } catch (error) {
      console.log('error signing up:', error)
    }
  }

  function handleUserName(e) {
    //console.log('UserName', e.target.value)
    setUserName(e.target.value)
  }

  function handlePassword(e) {
    //console.log('password', e.target.value)
    setPassword(e.target.value)
  }

  return (
    <div className="bg-light min-vh-100 d-flex flex-row">
      <CContainer>
        <CRow>
          <CCol style={{ height: '100px' }}></CCol> {/* just padding */}
        </CRow>
        <CRow className="justify-content-center">
          <CCol md={4}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm>
                    <h5>Login to BPAdmin</h5>
                    <p className="text-medium-emphasis">Sign In to your account</p>
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        placeholder="Username"
                        //autoComplete="username"
                        onChange={handleUserName}
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder="Password"
                        autoComplete="current-password"
                        onChange={handlePassword}
                      />
                    </CInputGroup>
                    <CRow>
                      <CCol xs={6}>
                        <CButton color="primary" className="px-4" onClick={handleLogin}>
                          Login
                        </CButton>
                      </CCol>
                      <CCol xs={6}>
                        <CButton color="primary" className="px-4" onClick={handleLogout}>
                          Logout
                        </CButton>
                      </CCol>
                      <CCol xs={6}>
                        <CButton color="primary" className="px-4" onClick={handleRegister}>
                          Test Register
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
