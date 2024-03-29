import log from './log'
import {User} from 'discord.js'
import fetch from 'node-fetch'
import express from 'express'
import config from '../config'
import {Database, UserDB} from './mongo'
import nonce from 'get-nonce'


const dexID = config.dexcom.id;
const dexSecret = config.dexcom.secret;
const dexURL = config.dexcom.url;
const redirect = config.dexcom.redirect;

/**
 * An OAuth 2 -> Discord authentication interface
 * Maps to one user.
 *
 */
class Authenticator {
  constructor(){
    this.baseURL = dexURL;
    this.id = dexID;
    this.secret = dexSecret;
    this.accessToken = null;
    this.refreshToken = null;
    this.redirect = redirect;
  }

  /**
   * async getAccessToken - An all in one function to perform DM Channel based OAuth2 authentication
   *
   * @param  {User} user a discord.js user object
   * @return {string}      the necessary access token for the user
   */
  async getAccessToken(user){
    //check db for existing tokens

    const userDoc = await UserDB.findById(user.id).exec();

    const hasUserToken = (userDoc.accessToken.token != null);

    if(hasUserToken){
      //consider the token expired if it's < 5 seconds before it really expires
      const tokenIsExpired = (userDoc.accessToken.expires.getTime() / 1000 - Date.now() / 1000) < 5;
      if(!tokenIsExpired){
        console.log(`token isnt expired`)
        return userDoc.accessToken.token;
      } else if (tokenIsExpired){
        console.log(`token IS expired`)
        return this.refreshAuthToken(user);
      }
    } else if(!hasUserToken){
      //do stuff
    }
  }




  //
  // below are a set of helper/utility functions for the main module features above.
  //

  async getAuthURL(user){
    //associate a nonce with the user in DB for later validation
    const state = Math.floor(Math.random()*2147483600);
    const userDoc = await UserDB.findById(user.id).exec();
    userDoc.state = state;
    await userDoc.save;


    const authURL = this.baseURL+`oauth2/login?client_id=${this.id}&redirect_uri=${this.redirect}&response_type=code&scope=offline_access&state=${state}`;
    return authURL;
  }

  async promptUser(user){
    const authURL = this.getAuthURL(user);
    const userDM = await user.createDM()
    userDM.send(`Please use the following link to authenticate with Dexcom & provide us access to your data : \`${await authURL}\``);
  }




  static async exchangeAuthCode(authCode, userDoc){
    log.info(`InExchangeAUthCode`)
    const options = {
        // These properties are part of the Fetch Standard
        method: 'POST',
        headers: {
          'Content-Type' : 'application/x-www-form-urlencoded'
        },
        body: {
          client_secret: this.secret,
          client_id: this.id,
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: this.redirect,
        }
    };
    const response = await fetch(this.baseURL+'oauth2/token', options);
    userDoc.accessToken.token = response.query.access_token;
    userDoc.accessToken.expires = new Date(Date.now() + response.query.expires_in);
    userDoc.refreshToken.token = response.query.refresh_token;
    await userDoc.save();
  }

  async refreshAuthToken(user){
    const userDoc = await UserDB.findById(user.id).exec();
    const refreshToken = userDoc.refreshToken.token;
    const options = {
        // These properties are part of the Fetch Standard
        method: 'POST',
        headers: {
          'Content-Type' : 'application/x-www-form-urlencoded'
        },
        body: {
          client_secret: this.secret,
          client_id: this.id,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          redirect_uri: this.redirect,
        }
    };
    const response = await fetch(this.baseURL+'oauth2/token', options);
    const json = await response.json();
    userDoc.accessToken.token = json.access_token;
    //THIS IS BROKEN
    userDoc.accessToken.expires = new Date(Date.now() + json.expires_in);
    userDoc.refreshToken.token = json.refresh_token;
    await userDoc.save();

    return response.query.access_token;
    //trade refresh toke for access token


  }
}


export default Authenticator
