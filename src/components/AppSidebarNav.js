import React, { useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { NavLink, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'
import { CNavItem } from '@coreui/react'
import { CBadge } from '@coreui/react'
import { Auth } from 'aws-amplify'

export const AppSidebarNav = ({ items }) => {
  const location = useLocation()

  // We need to be able to set the logged in status from <Login>
  const { setLoggedIn, loggedIn } = useContext(loggedInContext)

  async function logout() {
    try {
      await Auth.signOut()
      setLoggedIn({
        username: false,
      })
    } catch (err) {
      console.log('Logging out error', err)
    }
  }

  const navLink = (name, icon, badge) => {
    return (
      <>
        {icon && icon}
        {name && name}
        {badge && (
          <CBadge color={badge.color} className="ms-auto">
            {badge.text}
          </CBadge>
        )}
      </>
    )
  }

  const navItem = (item, index) => {
    const { component, name, badge, icon, ...rest } = item
    const Component = component
    return (
      <Component
        {...(rest.to &&
          !rest.items && {
            component: NavLink,
            activeClassName: 'active',
          })}
        key={index}
        {...rest}
      >
        {navLink(name, icon, badge)}
      </Component>
    )
  }
  const navGroup = (item, index) => {
    const { component, name, icon, to, ...rest } = item
    const Component = component
    return (
      <Component
        idx={String(index)}
        key={index}
        toggler={navLink(name, icon)}
        visible={location.pathname.startsWith(to)}
        {...rest}
      >
        {item.items?.map((item, index) =>
          item.items ? navGroup(item, index) : navItem(item, index),
        )}
      </Component>
    )
  }

  return (
    <React.Fragment>
      <div>
        {items &&
          items.map((item, index) => (item.items ? navGroup(item, index) : navItem(item, index)))}
        {loggedIn.username && (
          <CNavItem>
            <div onClick={logout} className="logoutButton">
              Logout
            </div>
          </CNavItem>
        )}
      </div>
    </React.Fragment>
  )
}

AppSidebarNav.propTypes = {
  items: PropTypes.arrayOf(PropTypes.any).isRequired,
}
