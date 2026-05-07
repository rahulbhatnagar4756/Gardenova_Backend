import nodemailer, { Transporter } from "nodemailer";
import config from "../config/env";
import { passwordResetEmailTemplate } from "../../templates/passwordResetEmail";
import {
  leadSuccessEmailTemplateForAdmin,
  leadSuccessEmailTemplateForPartner,
  leadSuccessEmailTemplateForUser,
} from "../../templates/leadsGeneratedEmail";
import { professionalWelcomeEmailTemplate } from "../../templates/sendWelcomeEmail";
import { leadTemplateForSuppliers } from "../../templates/leademalForSupplier";
import { leadNotificationForProfessional } from "../../templates/LeadNotificationForProfessional";
import { leadNotificationForUser } from "../../templates/LeadNotificationForUser";
import { leadNotificationForAdmin } from "../../templates/leadNotificationForAdmin";

/**
 * Creates and configures an email transporter using Nodemailer.
 *
 * @returns {Transporter} A Nodemailer transporter instance configured with Gmail (or chosen service).
 */
export const createTransporter = (): Transporter => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // or your email service
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS, // Use app password for Gmail
    },

  });
};

/**    
 * Sends a password reset email with a token to the user.
 *
 * @param email - The recipient's email address.
 * @param resetToken - The token used for password reset (6 digits).
 * @param userName - The name of the user receiving the email.
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  userName: string
): Promise<void> => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Password Reset - Your 6-Digit Code",
    html: passwordResetEmailTemplate(resetToken, userName),
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Sends emails related to a lead to the User, the Partner, and the Admin.
 *
 * This function sends customized emails to each recipient using the provided
 * user, partner, and optional lead information. Lead details like phone number,
 * message, service, lead ID, and timestamp can be included in the email content.
 *
 * @param {Object} userData - Information about the user receiving the email.
 * @param {string} userData.email - The user's email address.
 * @param {string} userData.name - The user's full name.
 *
 * @param {Object} partnerData - Information about the partner receiving the email.
 * @param {string} partnerData.email - The partner's email address.
 * @param {string} partnerData.name - The partner's full name.
 * @param {string} [partnerData.logoUrl] - Optional URL of the partner's logo.
 *
 * @param {string} adminEmail - Email address of the admin to receive notifications.
 *
 * @param {Object} [leadDetails] - Optional additional details about the lead.
 * @param {string} [leadDetails.phone] - Lead's phone number.
 * @param {string} [leadDetails.message] - Message provided by the lead.
 * @param {string} [leadDetails.service] - Service the lead is interested in.
 * @param {string} [leadDetails.leadId] - Unique identifier for the lead.
 * @param {string} [leadDetails.timestamp] - Timestamp of when the lead was created.
 *
 * @param partnersData
 * @returns {Promise<void>} - A promise that resolves once all emails have been sent.
 *
 */
export const sendLeadEmails = async (
  userData: {
    email: string;
    name: string;
  },
  partnersData: Array<{
    email: string;
    name: string;
    logoUrl?: string;
  }>,
  adminEmail: string,
  leadDetails?: {
    phone?: string;
    message?: string;
    service?: string;
    leadId?: string;
    timestamp?: string;
  }
): Promise<void> => {
  const transporter = createTransporter();

  // 1. Send email to USER (with all partners info)
  const userMailOptions = {
    from: process.env.EMAIL_FROM,
    to: userData.email,
    subject: `Quote Request Confirmation - ${partnersData.length} Partner${partnersData.length > 1 ? "s" : ""} | GARDENOVA`,
    html: leadSuccessEmailTemplateForUser(
      partnersData, // Pass full array of partners
      userData.name
    ),
  };

  // 2. Send email to each PARTNER individually
  const partnerMailPromises = partnersData.map((partner) => {
    const partnerMailOptions = {
      from: process.env.EMAIL_FROM,
      to: partner.email,
      subject: `New Lead Alert - ${userData.name} | GARDENOVA`,
      html: leadSuccessEmailTemplateForPartner(
        partner.name,
        userData.name,
        userData.email,
        leadDetails
      ),
    };
    return transporter.sendMail(partnerMailOptions);
  });

  // 3. Send email to ADMIN (with all partners info)
  const adminMailOptions = {
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `New Lead Generated - ${partnersData.length} Partner${partnersData.length > 1 ? "s" : ""} → ${userData.name}`,
    html: leadSuccessEmailTemplateForAdmin(
      partnersData, // Pass full array of partners with name and email
      userData.name,
      userData.email,
      leadDetails
    ),
  };

  // Send all emails in parallel
  await Promise.all([
    transporter.sendMail(userMailOptions),
    ...partnerMailPromises,
    transporter.sendMail(adminMailOptions),
  ]);
};

interface WelcomeEmailData {
  email: string;
  name: string;
  password: string;
  trialEndDate: string;
}
/**
 * Sends a welcome email to a newly registered professional user.
 *
 * The email contains:
 * - Login email
 * - Generated password
 * - Trial expiration date
 *
 * @param {WelcomeEmailData} data - Professional user email details.
 * @param {string} data.email - Recipient email address.
 * @param {string} data.name - Professional's full name.
 * @param {string} data.password - Generated temporary password.
 * @param {Date} data.trialEndDate - Trial expiration date.
 *
 * @returns {Promise<void>} Resolves when the email is successfully sent.
 */
export const sendProfessionalWelcomeEmail = async (
  data: WelcomeEmailData
): Promise<void> => {
  const transporter = createTransporter();

  // Format the trial end date
  // const formattedTrialEndDate = data.trialEndDate.toLocaleDateString('en-US', {
  //   year: 'numeric',
  //   month: 'long',
  //   day: 'numeric'
  // });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: data.email,
    subject: "Welcome to GARDENOVA Professional - Your Account is Ready!",
    html: professionalWelcomeEmailTemplate(
      data.name,
      data.email,
      data.password,
      data.trialEndDate
    ),
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Sends a lead email to multiple suppliers.
 * 
 * This function takes the user and supplier data, formats the email for each supplier,
 * and sends the email using the configured transporter.
 * 
 * @param {Object} userData - The data of the user sending the lead.
 * @param {string} userData.email - The email of the user.
 * @param {string} userData.name - The name of the user.
 * @param {Array<Object>} suppliersData - A list of suppliers to send the lead email to.
 * @param {string} suppliersData[].email - The email address of the supplier.
 * @param {string} suppliersData[].name - The name of the supplier.
 * 
 * @returns {Promise<void>} A promise that resolves when all supplier emails have been sent.
 * 
 * @throws {Error} If there's an issue with sending emails, an error will be thrown.
 */
export const sendLeadsEmailToSuppliers = async (
  userData: {
    email: string;
    name: string;
  },
  suppliersData: Array<{
    email: string;
    company_name: string;
  }>,
): Promise<void> => {
  const transporter = createTransporter();
  const supplierMailPromises = suppliersData.map((supplier) =>
    transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: supplier.email,
      subject: `New Lead Alert - ${userData.name} | GARDENOVA`,
      html: leadTemplateForSuppliers(supplier.company_name, userData.name, userData.email),
    })
  );

  await Promise.all(supplierMailPromises);
};

/**
 * Sends an email notification to the professional when a new lead is created.
 *
 * @async
 * @function sendLeadCreationEmailToProfessional
 * @param {Object} params - Function parameters
 * @param {string} params.professionalEmail - Email address of the professional receiving the lead
 * @param {string} params.subject - Subject line of the email
 * @param {string} params.userEmail - Email address of the user who created the lead
 * @param {string} params.userName - Name of the user who created the lead
 * @param {string} params.description - Description of the lead provided by the user
 * @param {string} params.category - Category of the lead provided by the user
 * @param {string} params.size - Size of the lead provided by the user
 * @returns {Promise<void>} Resolves when the email is successfully sent
 */
export const sendLeadCreationEmailToProfessional = async ({
  professionalEmail,
  subject,
  userEmail,
  userName,
  description,
  category,
  size
}: {
  professionalEmail: string;
  subject: string;
  userEmail: string;
  userName: string;
  description: string | null;
  category: string | null;
  size: string | null;
}): Promise<void> => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: professionalEmail,
    subject: subject,
    html: leadNotificationForProfessional(
      professionalEmail,
      userName,
      userEmail,
      description,
      category,
      size
    ),
  });
}

/**
 * Sends a confirmation email to the user after a lead is created.
 *
 * @async
 * @function sendLeadCreationEmailToUser
 * @param {Object} params - Function parameters
 * @param {string} params.userEmail - Email address of the user
 * @param {string} params.subject - Subject line of the email
 * @param {string} params.professionalEmail - Email address of the professional associated with the lead
 * @param {string} params.description - Description of the lead provided by the user
 * @param {string} params.category - Category of the lead provided by the user
 * @param {string} params.size - Size of the lead provided by the user
 * @returns {Promise<void>} Resolves when the email is successfully sent
 */
export const sendLeadCreationEmailToUser = async ({
  userEmail,
  subject,
  professionalEmail,
  description,
  category,
  size
}: {
  userEmail: string;
  subject: string;

  professionalEmail: string;
  description: string | null;
  category: string | null;
  size: string | null;
}): Promise<void> => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: subject,
    html: leadNotificationForUser(
      userEmail,
      professionalEmail,
      description,
      category,
      size
      ),
  }); 
}

/**
 * Sends a notification email to the admin when a new lead is created.
 *
 * @async
 * @function sendLeadCreationEmailTOAdmin
 * @param {Object} params - Function parameters
 * @param {string} params.subject - Subject line of the email
 * @param {string} params.userEmail - Email address of the user who created the lead
 * @param {string} params.professionalEmail - Email address of the professional assigned to the lead
 * @param {string} params.description - Description of the lead provided by the user
 * @param {string} params.category - Category of the lead provided by the user
 * @param {string} params.size - Size of the lead provided by the user
 * @returns {Promise<void>} Resolves when the email is successfully sent
 */
export const sendLeadCreationEmailTOAdmin = async ({
  subject,
  userEmail,
  professionalEmail,
  description,
  category,
  size
}: {
  subject: string;
  userEmail: string;
  professionalEmail: string;
  description: string | null;
  category: string | null;
  size: string | null;

}): Promise<void> => {

  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: subject,

    html: leadNotificationForAdmin(
      userEmail,
      professionalEmail,
      description,
      category,
      size
    ),
  });
}
