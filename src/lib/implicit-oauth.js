import { Map } from 'immutable';
import { randomStr } from 'Lib/randomGenerator';
import history from 'Routing/history';

function createNonce() {
  const nonce = randomStr();
  window.sessionStorage.setItem("netlify-cms-auth", JSON.stringify({ nonce }));
  return nonce;
}

function validateNonce(check) {
  const auth = window.sessionStorage.getItem("netlify-cms-auth");
  const valid = auth && JSON.parse(auth).nonce;
  window.localStorage.removeItem("netlify-cms-auth");
  return (check === valid);
}

export default class ImplicitAuthenticator {
  constructor(config = {}) {
    this.auth_url = config.auth_url;
    this.appid = config.appid;
  }

  authenticate(options, cb) {
    if (
          document.location.protocol !== "https:"
          // TODO: Is insecure localhost a bad idea as well? I don't think it is, since you are not actually
          //       sending the token over the internet in this case, assuming the auth URL is secure.
          && (document.location.hostname !== "localhost" && document.location.hostname !== "127.0.0.1")
       ) {
      return cb(new Error("Cannot authenticate over insecure protocol!"));
    }

    const authURL = new URL(this.auth_url);
    authURL.searchParams.set('client_id', this.appid);
    authURL.searchParams.set('redirect_uri', document.location.origin + document.location.pathname);
    authURL.searchParams.set('response_type', 'token');
    authURL.searchParams.set('scope', options.scope);
    authURL.searchParams.set('state', createNonce());

    document.location.assign(authURL.href);
  }

  /**
   * Complete authentication if we were redirected back to from the provider.
   */
  completeAuth(cb) {
    const hashParams = new URLSearchParams(document.location.hash.replace(/^#?\/?/, ''));
    if (!hashParams.has("access_token") && !hashParams.has("error")) {
      return;
    }
    // Remove tokens from hash so that token does not remain in browser history.
    history.replace('/');

    const params = Map(hashParams.entries());

    const validNonce = validateNonce(params.get('state'));
    if (!validNonce) {
      return cb(new Error("Invalid nonce"));
    }

    if (params.has('error')) {
      return cb(new Error(`${ params.get('error') }: ${ params.get('error_description') }`));
    }

    if (params.has('access_token')) {
      const { access_token: token, ...data } = params.toJS();
      cb(null, { token, ...data });
    }
  }
}