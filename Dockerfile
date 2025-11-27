# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy media files if needed
COPY дети.jpeg ./
COPY собака.mp4 ./

# Expose port if your app uses one (adjust if needed)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
