import "dotenv/config";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const createLocalStrategy = ({ authenticateLocal }) =>
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await authenticateLocal({ username, password });

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  });

const createGoogleStrategy = ({ authenticateGoogle }) =>
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"],
      state: false,
    },
    async (accessToken, refreshToken, profile, done) => {
      let email = null;

      try {
        const { provider, id: sub } = profile;
        const { givenName: firstName, familyName: lastName } = profile.name;

        // eslint-disable-next-line no-underscore-dangle
        const isEmailVerified = profile._json.email_verified;

        if (isEmailVerified) {
          // eslint-disable-next-line no-underscore-dangle
          email = profile._json.email;
        }

        const user = await authenticateGoogle({
          provider,
          sub,
          email,
          firstName,
          lastName,
          token: accessToken,
        });

        return done(null, user);
      } catch (e) {
        return done(e, null);
      }
    }
  );

export default (dependencies) => {
  const local = createLocalStrategy(dependencies);
  const google = createGoogleStrategy(dependencies);

  return Object.freeze({ local, google });
};
