const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const mongoose = require('mongoose');
require('dotenv').config(); // Sử dụng dotenv để tải các biến môi trường từ file .env

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const Schedule = require('./models/Schedule'); // Đường dẫn tới file chứa mô hình Schedule

const channelId = -1002233733301; // ID của kênh

// Kết nối tới MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// Thiết lập lịch để gửi tin nhắn vào lúc 6:00 mỗi ngày
cron.schedule('00 6 * * *', () => {
  sendDailySchedule();
});
cron.schedule('00 12 * * *', () => {
  sendDailySchedule();
});

// Thiết lập lịch để kiểm tra và gửi thông báo trước 1 giờ
cron.schedule('0 * * * *', () => {
  checkAndSendReminders();
});

bot.on('channel_post', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text.startsWith('/alh')) {
    const data = text.substring(5).split('&&');

    if (data.length === 6) {
      const newSchedule = new Schedule({
        subject: data[0].trim(),
        period: data[1].trim(),
        room: data[2].trim(),
        day: data[3].trim(),
        time: data[4].trim(),
        method: data[5].trim()
      });

      try {
        await newSchedule.save();
        bot.sendMessage(chatId, 'Lịch học đã được thêm thành công!');
      } catch (error) {
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi thêm lịch học.');
        console.error('Error saving schedule:', error);
      }
    } else {
      bot.sendMessage(chatId, 'Sai cú pháp.\n\nVui lòng sử dụng cú pháp:\n<code>/alh Tên môn học&&Tiết học&&Phòng học&&Thứ học&&Thời gian học&&Hình thức học</code>', {
        parse_mode: 'HTML'
      });
    }
  }
  else if (text === '/time') {
    const currentTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    bot.sendMessage(chatId, `Ngày giờ hiện tại là: ${currentTime}`);
  }
  else if (text === '/view') {
    sendDailySchedule();
  }
  else if (text === '/tt') {
    bot.sendMessage(chatId, 'Trang thối!');
  }
  else if (text === 'Random') {
    // Tạo ra một số ngẫu nhiên từ 0 đến 9
    const randomNumber = Math.floor(Math.random() * 10);
    
    // Gửi số ngẫu nhiên này cho người dùng
    bot.sendMessage(chatId, `Số ngẫu nhiên của bạn là: ${randomNumber}`);
  }
  
});

async function sendDailySchedule() {
  const daysOfWeek = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const currentDay = daysOfWeek[new Date().getDay()];
  const currentDate = new Date();

  try {
    const schedules = await Schedule.find({ day: currentDay });

    if (schedules.length > 0) {
      let message = `Lịch học hôm nay của bạn:\n\n___________________________________\n\n`;
      schedules.forEach(schedule => {
        const [startDate, endDate] = schedule.time.split('-').map(date => {
          const [day, month, year] = date.trim().split('/');
          return new Date(year, month - 1, day);
        });

        if (currentDate >= startDate && currentDate <= endDate) {
          const periodTime = convertPeriodToTime(schedule.period);
          message += `Môn học: <code>${schedule.subject}</code>\n\n`;
          message += `Tiết học: <code>${periodTime}</code>\n\n`;
          message += `Phòng học: <code>${schedule.room}</code>\n\n`;
          message += `Thời gian: <code>${schedule.time}</code>\n\n`;
          message += `Hình thức: <code>${schedule.method}</code>\n\n`;
          message += `___________________________________\n\n`;
        }
      });

      if (message === `Lịch học hôm nay của bạn:\n\n___________________________________\n\n`) {
        bot.sendMessage(channelId, `Không có lịch học cho ${currentDay} trong khoảng thời gian hiện tại.`);
      } else {
        bot.sendMessage(channelId, message, {
          parse_mode: 'HTML'
        });
      }
    } else {
      bot.sendMessage(channelId, `Không có lịch học cho ${currentDay}.`);
    }
  } catch (error) {
    bot.sendMessage(channelId, 'Đã xảy ra lỗi khi lấy lịch học.');
    console.error('Error retrieving schedule:', error);
  }
}

async function checkAndSendReminders() {
  const daysOfWeek = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const currentDay = daysOfWeek[new Date().getDay()];
  const currentDate = new Date();
  const currentHour = currentDate.getHours();

  try {
    const schedules = await Schedule.find({ day: currentDay });

    schedules.forEach(schedule => {
      const [startDate, endDate] = schedule.time.split('-').map(date => {
        const [day, month, year] = date.trim().split('/');
        return new Date(year, month - 1, day);
      });

      if (currentDate >= startDate && currentDate <= endDate) {
        const periodTime = convertPeriodToTime(schedule.period);
        const periodStartHour = getPeriodStartHour(schedule.period);

        if (periodStartHour !== null && periodStartHour - 1 === currentHour) {
          const message = `Còn 1 giờ nữa là đến môn học <code>${schedule.subject}</code>\n\nTiết học: <code>${periodTime}</code>\n\nPhòng học: <code>${schedule.room}</code>\n\nThời gian: <code>${schedule.time}</code>\n\nHình thức: <code>${schedule.method}</code>`;
          bot.sendMessage(channelId, message, {
            parse_mode: 'HTML'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}

function convertPeriodToTime(period) {
  switch (period) {
    case '1-3':
      return '7:00-9:30';
    case '4-6':
      return '9:30-12:00';
    case '7-9':
      return '13:00-15:30';
    case '10-12':
      return '15:30-18:00';
    default:
      return 'Thời gian không xác định';
  }
}

function getPeriodStartHour(period) {
  switch (period) {
    case '1-3':
      return 7;
    case '4-6':
      return 9;
    case '7-9':
      return 13;
    case '10-12':
      return 15;
    default:
      return null;
  }
}
