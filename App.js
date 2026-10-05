import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";

import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";


const API_BASE =
  "https://gyan-ai-ef7h.onrender.com";

const LOGIN_ENDPOINT =
  `${API_BASE}/api/login`;

const REGISTER_ENDPOINT =
  `${API_BASE}/api/register`;

const CHAT_ENDPOINT =
  `${API_BASE}/api/chat`;

const LOGOUT_ENDPOINT =
  `${API_BASE}/api/logout`;

const HISTORY_ENDPOINT =
  `${API_BASE}/api/history`;

const MEMORY_ENDPOINT =
  `${API_BASE}/api/memory`;


const TOKEN_KEY =
  "gyan_auth_token";

const USER_ID_KEY =
  "gyan_user_id";

const USERNAME_KEY =
  "gyan_username";

const PINNED_KEY =
  "gyan_pinned_chats";

const PROJECTS_KEY =
  "gyan_projects";

const LIBRARY_KEY =
  "gyan_library";

const SCHEDULE_KEY =
  "gyan_schedule";

const IMAGE_LIBRARY_KEY =
  "gyan_image_library";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


function GyanLogo({ size = 44 }) {
  return (
    <View
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <View
        style={[
          styles.logoRing,
          {
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.logoText,
            { fontSize: size * 0.52 },
          ]}
        >
          G
        </Text>
      </View>
    </View>
  );
}


function MessageText({ content }) {
  const parts = String(content || "")
    .split(/(https?:\/\/[^\s]+)/g);

  return (
    <Text style={styles.messageText}>
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          const cleanUrl =
            part.replace(/[),.!?;:]+$/, "");

          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() =>
                Linking.openURL(cleanUrl)
              }
            >
              {part}
            </Text>
          );
        }

        return (
          <Text key={index}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}


function MessageBubble({
  item,
  onCopy,
  onShare,
  onSpeak,
}) {
  const isUser =
    item.role === "user";

  return (
    <View
      style={[
        styles.messageRow,
        isUser
          ? styles.userRow
          : styles.aiRow,
      ]}
    >
      {!isUser && (
        <GyanLogo size={32} />
      )}

      <View
        style={[
          styles.messageBubble,
          isUser
            ? styles.userBubble
            : styles.aiBubble,
        ]}
      >
        {item.attachment && (
          <View style={styles.attachment}>
            <Ionicons
              name={
                item.attachment.type ===
                "image"
                  ? "image-outline"
                  : "document-outline"
              }
              size={18}
              color="#38BDF8"
            />

            <Text
              style={styles.attachmentName}
              numberOfLines={1}
            >
              {item.attachment.name}
            </Text>
          </View>
        )}

        <MessageText
          content={item.content}
        />

        {!isUser && (
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                onCopy(item.content)
              }
            >
              <Ionicons
                name="copy-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                onShare(item.content)
              }
            >
              <Ionicons
                name="share-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                onSpeak(item.content)
              }
            >
              <Ionicons
                name="volume-medium-outline"
                size={17}
                color="#AAB4C3"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}


function AuthScreen({
  onLoginSuccess,
}) {
  const [mode, setMode] =
    useState("login");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  async function submitAuth() {
    const name =
      username.trim();

    if (!name || !password) {
      Alert.alert(
        "Login",
        "Username और password दोनों डालो।"
      );
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? LOGIN_ENDPOINT
          : REGISTER_ENDPOINT;

      const response =
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username: name,
            password,
          }),
        });

      const data =
        await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
          `Server error ${response.status}`
        );
      }

      if (!data.token) {
        throw new Error(
          "Login token नहीं मिला।"
        );
      }

      await AsyncStorage.multiSet([
        [
          TOKEN_KEY,
          String(data.token),
        ],
        [
          USER_ID_KEY,
          String(data.user_id || ""),
        ],
        [
          USERNAME_KEY,
          String(
            data.username || name
          ),
        ],
      ]);

      onLoginSuccess({
        token: String(data.token),
        userId: String(
          data.user_id || ""
        ),
        username: String(
          data.username || name
        ),
      });

      setPassword("");
    } catch (error) {
      Alert.alert(
        mode === "login"
          ? "Login failed"
          : "Registration failed",
        String(
          error?.message || error
        )
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <SafeAreaView
      style={styles.authContainer}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080C12"
      />

      <View style={styles.authContent}>
        <GyanLogo size={88} />

        <Text style={styles.authTitle}>
          Gyan AI
        </Text>

        <Text style={styles.authSubtitle}>
          Intelligent AI Assistant
        </Text>

        <View style={styles.authCard}>
          <View style={styles.authTabs}>
            <TouchableOpacity
              style={[
                styles.authTab,
                mode === "login" &&
                  styles.authTabActive,
              ]}
              onPress={() =>
                setMode("login")
              }
            >
              <Text
                style={[
                  styles.authTabText,
                  mode === "login" &&
                    styles.authTabTextActive,
                ]}
              >
                Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.authTab,
                mode === "register" &&
                  styles.authTabActive,
              ]}
              onPress={() =>
                setMode("register")
              }
            >
              <Text
                style={[
                  styles.authTabText,
                  mode === "register" &&
                    styles.authTabTextActive,
                ]}
              >
                Register
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.authLabel}>
            Username
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor="#6F7B8C"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.authInput}
          />

          <Text style={styles.authLabel}>
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#6F7B8C"
            secureTextEntry
            style={styles.authInput}
          />

          <TouchableOpacity
            style={styles.authButton}
            onPress={submitAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={styles.authButtonText}
              >
                {mode === "login"
                  ? "Login to Gyan AI"
                  : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
