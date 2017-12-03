import Actor from './Actor.js'
import { get, post } from './api.js'

export default class SessionActor extends Actor {
  init() {
    // When there's a session update, update the UI too.
    this.on('update', (loggedIn, sessionObj) => {
      const loginStatusEl = document.getElementById('login-status')
      const [ registerEl, loginEl, logoutEl ] = document.querySelectorAll('.session-action-btn')
      const formEl = document.getElementById('form')

      // TODO: should probably use a CSS class at some app root level
      //       for showing/hiding the buttons based on login state.

      if (loggedIn) {
        loginStatusEl.innerText = 'Logged in as ' + sessionObj.user.username

        registerEl.style.display = 'none'
        loginEl.style.display = 'none'
        logoutEl.style.removeProperty('display')
        formEl.style.removeProperty('display')
      } else {
        loginStatusEl.innerText = 'Not logged in'

        registerEl.style.removeProperty('display')
        loginEl.style.removeProperty('display')
        logoutEl.style.display = 'none'
        formEl.style.display = 'none'
      }
    })

    document.getElementById('register').addEventListener('click', () => {
      this.promptRegister()
    })

    document.getElementById('login').addEventListener('click', () => {
      this.promptLogin()
    })

    document.getElementById('logout').addEventListener('click', () => {
      this.loadSessionID('')
    })
  }

  go() {
    // Load session from LocalStorage, if it has that data.
    if ('sessionID' in localStorage) {
      this.loadSessionID(localStorage.sessionID)
    } else this.loadSessionID('')
  }

  isCurrentUser(userID) {
    if (!this.loggedIn) return false
    else return this.sessionObj.user.id === userID
  }

  async loadSessionID(sessionID = '') {
    const sessionData = sessionID === ''
      ? { success: false } // No sessionID = logged out
      : await get('session/' + sessionID)

    if (sessionData.success) {
      this.loggedIn = true
      this.sessionObj = sessionData
    } else {
      this.loggedIn = false
      this.sessionObj = {}
    }

    localStorage.sessionID = this.sessionID = sessionID
    this.emit('update', this.loggedIn, this.sessionObj)
  }

  async promptLogin() {
    let username, password

    try {
      username = await this.actors.modals.prompt(
        'Login', 'Username?', '',
        async name => {
          const reValid = /^[a-zA-Z0-9-_]+$/

          if (name.length === 0) {
            throw 'Please enter a username.'
          } else if (!reValid.test(name)) {
            throw 'Usernames cannot contain special characters other than - and _.'
          }
        },
        'Continue', 'Cancel')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('login cancel', 1)

        return
      } else {
        throw error
      }
    }

    try {
      password = await this.actors.modals.prompt(
        'Login', 'Password?', '',
        async pass => {
          if (pass.length === 0) {
            throw 'Please enter a password.'
          }
        },
        'Continue', 'Cancel', 'password')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('login cancel', 2)

        return
      } else {
        throw error
      }
    }

    const result = await post('login', {username, password})

    if (result.error) {
      if (result.error === 'user not found') {
        this.actors.modals.alert('Login failure', `There is no user with the username ${username}.`)
      } else if (result.error === 'incorrect password') {
        this.actors.modals.alert('Login failure', `Incorrect password!`)
      }
      return
    }

    await this.loadSessionID(result.sessionID)
  }

  async promptRegister() {
    let username, password

    try {
      username = await this.actors.modals.prompt(
        'Register', 'Username?', '',
        async name => {
          const reValid = /^[a-zA-Z0-9-_]+$/

          if (name.length === 0) {
            throw 'Please enter a username.'
          } else if (!reValid.test(name)) {
            throw 'Usernames cannot contain special characters other than - and _.'
          }

          // TODO check if username is taken or not here, in advance
        },
        'Continue', 'Cancel')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('registration cancel', 1)

        return
      } else {
        throw error
      }
    }

    try {
      password = await this.actors.modals.prompt(
        'Register', 'Password? Must be at least 6 characters long.', '',
        async pass => {
          if (pass.length === 0) {
            throw 'Please enter a password.'
          } else if (pass.length < 6) {
            throw 'Your password needs to be at least 6 characters long.'
          }
        },
        'Continue', 'Cancel', 'password')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('registration cancel', 2)

        return
      } else {
        throw error
      }
    }

    const result = await post('register', {username, password})

    if (result.error) {
      if (result.error === 'password must be at least 6 characters long') {
        // impossible
        this.actors.modals.alert(`Couldn't create account`, 'Password too short.')
      } else if (result.error === 'username already taken') {
        this.actors.modals.alert(`Couldn't create account`, 'Username already taken.')
      } else if (result.error === 'username invalid') {
        // impossible
        this.actors.modals.alert(`Couldn't create account`, 'Username is invalid.')
      }

      this.emit('registration error', result.error)
      return result.error
    }

    this.actors.modals.alert('Account created', `Success! Account ${username} created. Please login.`)
    this.emit('registration success', result.user)

    return result.user
  }
}