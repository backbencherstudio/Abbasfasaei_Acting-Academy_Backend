// src/modules/auth/strategies/facebook.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      scope: 'email',
      profileFields: ['emails', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails, id } = profile;

    try {
      // Check if user exists in your database by email or facebookId
      const user = await this.authService.findOrCreateUserFromFacebook({
        email: emails[0].value,
        facebookId: id,
        firstName: name.givenName,
        lastName: name.familyName,
        name: `${name.givenName} ${name.familyName}`,
      });

      // Generate JWT token for the user
      const jwtToken = await this.authService.generateJWTForUser(user);

      const payload = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken: jwtToken,
      };

      done(null, payload);
    } catch (error) {
      done(error, null);
    }
  }
}
