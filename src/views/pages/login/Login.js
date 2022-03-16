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
import { useHistory } from 'react-router-dom'
import notify from 'devextreme/ui/notify'

const Login = () => {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')

  const history = useHistory()

  // We need to be able to set the logged in status from <Login>
  const { setLoggedIn } = useContext(loggedInContext)

  async function handleLogin() {
    try {
      if (userName && password) {
        console.log(`username: ${userName}, password ${password}`)
        let user = await Auth.signIn(userName, password)
        //const attributes = await Auth.userAttributes(user)
        console.log('signIn user', user)
        setLoggedIn({
          username: user.username,
          email: user.attributes.email,
          schoolName: user.attributes['custom:schoolName'],
        })
        history.push('/LandingPage')
      } else {
        notify('👋 Please enter username and password to login', 'error', 3000)
      }
    } catch (err) {
      console.log(err)
      if (err && err.message) notify(err.message, 'error', 3000)
    }
  }

  function handleKeyPress(target) {
    if (target.code === 'Enter') {
      handleLogin()
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
                  <CForm onSubmit={handleLogin} onKeyDown={handleKeyPress}>
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
