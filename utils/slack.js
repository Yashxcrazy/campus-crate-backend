const axios = require('axios');

/**
 * Send Slack notification using webhook
 */
const sendSlackNotification = async (notification) => {
  const webhookUrl = process.env.SLACK_WEBHOOK;

  if (!webhookUrl) {
    console.warn('⚠️ Slack webhook not configured, skipping notification');
    return;
  }

  try {
    await axios.post(webhookUrl, {
      text: notification.text,
      blocks: notification.blocks || []
    });

    console.log('✅ Slack notification sent successfully');
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error.message);
    // Don't throw - notifications shouldn't break main flow
  }
};

/**
 * Format new lending request notification
 */
const formatNewLendingRequestNotification = (lendingRequest, item, borrower) => {
  return {
    text: '🎉 New Lending Request!',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎉 New Lending Request',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Item:*\n${item.title}`
          },
          {
            type: 'mrkdwn',
            text: `*Borrower:*\n${borrower.name}`
          },
          {
            type: 'mrkdwn',
            text: `*Duration:*\n${new Date(lendingRequest.startDate).toLocaleDateString()} - ${new Date(lendingRequest.endDate).toLocaleDateString()}`
          },
          {
            type: 'mrkdwn',
            text: `*Total Cost:*\n₹${lendingRequest.totalCost}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Request ID: ${lendingRequest._id}`
          }
        ]
      }
    ]
  };
};

/**
 * Format request accepted notification
 */
const formatRequestAcceptedNotification = (lendingRequest, item) => {
  return {
    text: '✅ Lending Request Accepted!',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Request Accepted',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Your request for *${item.title}* has been accepted! 🎊`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Start Date:*\n${new Date(lendingRequest.startDate).toLocaleDateString()}`
          },
          {
            type: 'mrkdwn',
            text: `*End Date:*\n${new Date(lendingRequest.endDate).toLocaleDateString()}`
          }
        ]
      }
    ]
  };
};

/**
 * Format new review notification
 */
const formatNewReviewNotification = (review, fromUser, rating) => {
  const stars = '⭐'.repeat(rating);
  
  return {
    text: `${stars} New Review Received`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${stars} New Review Received`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*From:* ${fromUser.name}\n*Rating:* ${stars}\n*Comment:* "${review.comment}"`
        }
      }
    ]
  };
};

module.exports = {
  sendSlackNotification,
  formatNewLendingRequestNotification,
  formatRequestAcceptedNotification,
  formatNewReviewNotification
};