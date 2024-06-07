(function () {
  require('dotenv').config(
    Object.assign(
      {},
      require('dotenv/lib/env-options'),
      require('dotenv/lib/cli-options')(process.argv)
    )
  )
})()
