# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# Copy package files first for better caching
COPY package*.json ./

RUN npm ci --only=production

# Copy app source
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "server.js"]
