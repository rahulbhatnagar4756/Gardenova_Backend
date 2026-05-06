/**
 * Generates the HTML template for the password reset email.
 *
 * @param {string} resetToken - The unique token used for resetting the user's password.
 * @param {string} userName - The name of the user to personalize the email greeting.
 * @returns {string} The HTML string containing the formatted password reset email.
 */
export const passwordResetEmailTemplate = (
  resetToken: string,
  userName: string
): string => {
  return `
    <!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title></title>
    <style type="text/css">
        @media screen {

            /* cyrillic-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxC7mw9c.woff2) format('woff2');
                unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRzS7mw9c.woff2) format('woff2');
                unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
            }

            /* vietnamese */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxi7mw9c.woff2) format('woff2');
                unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRxy7mw9c.woff2) format('woff2');
                unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
                font-family: 'Montserrat';
                font-style: italic;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUQjIg1_i6t8kCHKm459WxRyS7m.woff2) format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }

            /* cyrillic-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WRhyzbi.woff2) format('woff2');
                unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
            }

            /* cyrillic */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459W1hyzbi.woff2) format('woff2');
                unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
            }

            /* vietnamese */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WZhyzbi.woff2) format('woff2');
                unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
            }

            /* latin-ext */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wdhyzbi.woff2) format('woff2');
                unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
            }

            /* latin */
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 100 900;
                font-display: swap;
                src: url(https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2) format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }
        }

        #outlook a {
            padding: 0;
        }

        .ExternalClass,
        .ReadMsgBody {
            width: 100%;
        }

        .ExternalClass,
        .ExternalClass p,
        .ExternalClass td,
        .ExternalClass div,
        .ExternalClass span,
        .ExternalClass font {
            line-height: 100%;
        }

        div[style*="margin: 14px 0;"],
        div[style*="margin: 16px 0;"] {
            margin: 0 !important;
        }

        @media only screen and (min-width:621px) {
            .pc-container {
                width: 620px !important;
            }
        }

        @media only screen and (max-width:620px) {
            .pc-header-box-s6 .pc-header-box-in {
                padding: 29px 16px 26px !important
            }

            .pc-header-logo-s1,
            .pc-header-nav-s1 {
                width: 100% !important
            }

            .pc-header-cta-s4 {
                text-align: center !important
            }

            .pc-footer-row-s1 .pc-footer-row-col,
            .pc-header-cta-s4 .pc-header-cta-col {
                max-width: 100% !important
            }

            .pc-header-cta-s4 .pc-header-cta-acs,
            .pc-header-cta-s4 .pc-header-cta-icon,
            .pc-header-cta-s4 .pc-header-cta-img {
                Margin: 0 auto !important
            }

            .pc-header-cta-s4 .pc-header-cta-text br,
            .pc-header-cta-s4 .pc-header-cta-title br {
                display: none !important
            }

            .pc-features-row-s1 .pc-features-row-col {
                max-width: 50% !important
            }

            .pc-cta-box-s14 .pc-cta-box-in {
                padding-bottom: 35px !important;
                padding-top: 35px !important
            }

            .pc-footer-box-s1 {
                padding-left: 10px !important;
                padding-right: 10px !important
            }

            .pc-spacing.pc-m-footer-h-46 td,
            .pc-spacing.pc-m-footer-h-57 td {
                font-size: 20px !important;
                height: 20px !important;
                line-height: 20px !important
            }
        }

        @media only screen and (max-width:525px) {
            .pc-header-box-s6 .pc-header-box-in {
                padding: 15px 6px 5px !important
            }

            .pc-spacing.pc-m-header-7 {
                font-size: 22px !important;
                height: 22px !important;
                line-height: 22px !important
            }

            .pc-cta-title br,
            .pc-footer-text-s1 br,
            .pc-header-cta-text br,
            .pc-header-cta-title br {
                display: none !important
            }

            .pc-features-row-s1 .pc-features-row-col {
                max-width: 100% !important
            }

            .pc-cta-box-s14 .pc-cta-box-in {
                padding: 25px 20px !important
            }

            .pc-cta-s1 .pc-cta-title {
                font-size: 24px !important;
                line-height: 1.42 !important
            }

            .pc-cta-icon.pc-m-module-18 {
                height: auto !important;
                width: 72px !important
            }

            .pc-footer-box-s1 {
                padding: 5px 0 !important
            }
        }
    </style>
    <!--[if mso]>
    <style type="text/css">
      .pc-fb-font{font-family:Helvetica,Arial,sans-serif !important;}
    </style>
    <![endif]-->
    <!--[if gte mso 9]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->
</head>

<body class="pc-fb-font" bgcolor="#ffffff"
    style="background-color: #ffffff; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; width: 100% !important; Margin: 0 !important; padding: 0; line-height: 1.5; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%">
    <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%" border="0" cellpadding="0"
        cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 0; vertical-align: top;" align="center" valign="top">
                    <!--[if (gte mso 9)|(IE)]>
                    <table width="620" align="center" border="0" cellspacing="0" cellpadding="0"><tr><td width="620" align="center" valign="top">
                    <![endif]-->
                    <table class="pc-container" align="center"
                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; Margin: 0 auto; max-width: 620px;"
                        width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tbody>
                            <tr>
                                <td align="left" style="vertical-align: top; padding: 0 10px;" valign="top">
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                        <tbody>
                                            <tr>
                                                <td style="vertical-align: top; padding: 0; height: 20px; font-size: 0px; line-height: 20px;"
                                                    valign="top">&nbsp;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width:100%;" border="0"
                                        cellspacing="0" cellpadding="0" width="100%">
                                        <tbody>
                                            <tr>
                                                <td>

                                                    <!-- START MODULE: Feature 1 -->
                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 20px 20px; background-color: #2E3A30;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.42; letter-spacing: -0.4px; color: #151515; padding: 0 20px;"
                                                                                    valign="top">



                                                                                    <img src="https://newbucketassets.s3.sa-east-1.amazonaws.com/logo.png"
                                                                                        alt="Group-3" border="0" style="
    width: 60px;
    margin: 0 auto;
    display: block;
    padding: 20px 0;
">
                                                                                </td>
                                                                            </tr>


                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <!-- END MODULE: Feature 1 -->
                                                    <!-- START MODULE: Feature 1 -->
                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 20px 20px; background-color: #fbfbfb;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 20px; font-size: 0px; line-height: 20px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px;text-align: center;">
                                                                                    Password Reset Request
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 50px; font-size:0px; line-height: 50px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">
                                                                                    Hi <strong
                                                                                        style="font-weight: 600;word-break: break-all;">${userName},</strong>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">

                                                                                    We received a request to reset your
                                                                                    password for your Kasagardem
                                                                                    account. To proceed with the
                                                                                    password reset, please use the
                                                                                    verification code below.

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 10px; font-size: 0px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>

                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">
                                                                                    If you didn't request this password
                                                                                    reset, you can safely ignore this
                                                                                    email. Your account remains secure.

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 10px; font-size: 0px; line-height: 10px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="  vertical-align: top; padding: 20px 20px; margin-top: 10px; display: block; border: 1px solid #2E3A302b; border-radius: 10px; background: #2E3A3012;"
                                                                                    valign="top" align="center">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                                                                        <tbody
                                                                                            style="vertical-align: top; border-radius: 8px; text-align: center; ">
                                                                                            <tr>
                                                                                                <td style="font-size: 15px;     font-weight: 600;
    color: #2E3A30; text-align: center; text-transform: uppercase;">
                                                                                                    Your Verification
                                                                                                    Code
                                                                                                </td>
                                                                                            </tr>
                                                                                            <tr>
                                                                                                <td style="       font-size: 20px;
    font-weight: 600;
    color: #2E3A30;
    text-align: center;
    text-transform: uppercase;
    display: block;
    margin-top: 10px;
    border: 1px solid #2E3A303b;
    border-radius: 10px;
    background: #fff;
    padding: 10px 20px;
    letter-spacing: 6px;">
                                                                                                    <table border="0"
                                                                                                        cellpadding="0"
                                                                                                        cellspacing="0"
                                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                                                                                                        <tbody
                                                                                                            style="vertical-align: top; border-radius: 8px; text-align: center; ">
                                                                                                            <tr>
                                                                                                                <td>
                                                                                                                    <p> ${resetToken}
                                                                                                                    </p>
                                                                                                                </td>
                                                                                                            </tr>
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </td>
                                                                                            </tr>
                                                                                            <tr>
                                                                                                <td style="    padding-top: 20px;
    font-size: 14px;
    color: #424242;">
                                                                                                    <span
                                                                                                        style="font-weight: 600;">
                                                                                                        Time Sensitive:
                                                                                                    </span>
                                                                                                    This code expires in
                                                                                                    5 minutes
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 30px; font-size: 0px; line-height: 30px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="    vertical-align: top;
    font-family: 'Montserrat', Helvetica, Arial, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.42;
    letter-spacing: -0.4px;
    color: #424242;
    padding: 0 20px;" valign="top">Security Tips
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.42; letter-spacing: -0.4px; color: #424242; padding: 0 20px; ">

                                                                                    <ul
                                                                                        style="padding-left: 20px; margin-top: 0;">
                                                                                        <li>
                                                                                            Never share your reset code
                                                                                            with anyone
                                                                                        </li>
                                                                                        <li>
                                                                                            Kasagardem will never ask
                                                                                            for your password via email
                                                                                        </li>
                                                                                        <li>
                                                                                            Use a strong, unique
                                                                                            password for your account
                                                                                        </li>
                                                                                    </ul>

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>
                                                                           
                                                                            <tr>
                                                                                <td style="vertical-align: top;"
                                                                                    valign="top">
                                                                                    <table border="0" cellpadding="0"
                                                                                        cellspacing="0"
                                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                                        width="100%">
                                                                                        <tbody>
                                                                                            <tr>
                                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                                    valign="top">&nbsp;
                                                                                                </td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </td>
                                                                            </tr>


                                                                           



                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <!-- END MODULE: Feature 1 -->

                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                        width="100%">
                                                        <tbody>
                                                            <tr>
                                                                <td class="pc-features-box-s1"
                                                                    style="vertical-align: top; padding: 40px 20px; background-color: #2E3A30;"
                                                                    valign="top">
                                                                    <table border="0" cellpadding="0" cellspacing="0"
                                                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"
                                                                        width="100%">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; letter-spacing: -0.4px; color: #ffffff; padding: 0 20px;text-align: center;"
                                                                                    align="center" valign="top">
                                                                                    If you didn't request this password
                                                                                    reset,
                                                                                    <br>
                                                                                    please contact us immediately to
                                                                                    secure your account.

                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td style="vertical-align: top; height: 15px; font-size: 0px; line-height: 15px;"
                                                                                    valign="top">&nbsp;
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td class="pc-fb-font"
                                                                                    style="vertical-align: top; font-family: 'Montserrat', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 1.62; letter-spacing: -0.4px; color: #ffffff; padding: 0 20px;text-align: center;"
                                                                                    align="center" valign="top">
                                                                                    Need assistance?
                                                                                    <a
                                                                                        href="mailto:helpdesk@kasagardem.com" style="
    color: #fff;
">helpdesk@kasagardem.com.</a>
                                                                                </td>
                                                                            </tr>


                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>



                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <table border="0" cellpadding="0" cellspacing="0"
                                        style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                                        <tbody>
                                            <tr>
                                                <td style="vertical-align: top; padding: 0; height: 20px; font-size: 20px; line-height: 20px;"
                                                    valign="top">&nbsp;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <!--[if (gte mso 9)|(IE)]>
                    </td></tr></table>
                    <![endif]-->
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
  `;
};
