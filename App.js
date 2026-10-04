import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";

const API_BASE = "https://gyan-ai-ef7h.onrender.com";
const CHAT_ENDPOINT = `${API_BASE}/gradio_api/call/chat_submit`;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const listRef = useRef(null);

  const sendMessage = async () => {
    const question = text.trim();

    if (!question || loading) return;

    setText("");

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      text: question,
    };

    setMessages((old) => [...old, userMessage]);
    setLoading(true);

    try {
      /*
       * Gyan AI backend
       * Gradio endpoint:
       * /gradio_api/call/chat_submit
       */

      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [question],
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.event_id) {
        throw new Error("No event_id received");
      }

      const eventResponse = await fetch(
        `${CHAT_ENDPOINT}/${result.event_id}`
      );

      const raw = await eventResponse.text();

      let answer = "";

      /*
       * Gradio streaming response
       */
      const lines = raw.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const dataText = line.replace(/^data:\s*/, "").trim();

        if (!dataText || dataText === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataText);

          if (Array.isArray(parsed)) {
            const last = parsed[parsed.length - 1];

            if (typeof last === "string") {
              answer = last;
            } else if (last?.text) {
              answer = last.text;
            }
          } else if (typeof parsed === "string") {
            answer = parsed;
          } else if (parsed?.text) {
            answer = parsed.text;
          } else if (parsed?.output) {
            answer = parsed.output;
          }
        } catch {
          // Ignore non-JSON SSE lines
        }
      }

      if (!answer) {
        throw new Error("No answer text received");
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: answer,
      };

      setMessages((old) => [...old, aiMessage]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.log("Gyan AI Error:", error);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "AI सर्वर से उत्तर प्राप्त नहीं हुआ।",
      };

      setMessages((old) => [...old, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const speak = (message) => {
    Speech.stop();

    Speech.speak(message, {
      language: "hi-IN",
      rate: 0.9,
      pitch: 1,
    });
  };

  const clearChat = () => {
    Alert.alert(
      "नया चैट",
      "क्या आप वर्तमान चैट साफ करना चाहते हैं?",
      [
        { text: "रद्द करें", style: "cancel" },
        {
          text: "साफ करें",
          onPress: () => setMessages([]),
        },
      ]
    );
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.aiRow,
        ]}
      >
        <View
          style={[
            styles.avatar,
            isUser ? styles.userAvatar : styles.aiAvatar,
          ]}
        >
          <Text style={styles.avatarText}>
            {isUser ? "U" : "G"}
          </Text>
        </View>

        <View
          style={[
            styles.messageBox,
            isUser ? styles.userMessage : styles.aiMessage,
          ]}
        >
          <Text style={styles.messageText}>{item.text}</Text>

          {!isUser && (
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => speak(item.text)}
            >
              <Ionicons
                name="volume-high-outline"
                size={20}
                color="#b8c0cc"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>G</Text>
          </View>

          <View>
            <Text style={styles.title}>Gyan AI</Text>
            <Text style={styles.subtitle}>आपका AI Assistant</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newChatButton}
          onPress={clearChat}
        >
          <Ionicons
            name="add-outline"
            size={27}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {/* Chat */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.chat}
        contentContainerStyle={[
          styles.chatContent,
          messages.length === 0 && styles.emptyChat,
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.welcome}>
            <View style={styles.bigLogo}>
              <Text style={styles.bigLogoText}>G</Text>
            </View>

            <Text style={styles.welcomeTitle}>
              नमस्ते! मैं Gyan AI हूँ
            </Text>

            <Text style={styles.welcomeText}>
              आप मुझसे कोई भी सवाल पूछ सकते हैं।
            </Text>
          </View>
        }
      />

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.loadingText}>Gyan AI सोच रहा है...</Text>
        </View>
      )}

      {/* Composer */}
      <View style={styles.composerArea}>
        <TouchableOpacity
          style={styles.plusButton}
          onPress={() =>
            Alert.alert(
              "Gyan AI",
              "Plus features अगले चरण में जोड़े जाएंगे।"
            )
          }
        >
          <Ionicons
            name="add"
            size={25}
            color="#dce3ec"
          />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Gyan AI से कुछ पूछें..."
            placeholderTextColor="#7f8996"
            style={styles.input}
            multiline
            maxLength={4000}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || loading) &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || loading}
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color="#ffffff"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  header: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#202630",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  logo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#1f6feb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  logoText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },

  title: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
  },

  subtitle: {
    color: "#8b95a3",
    fontSize: 12,
    marginTop: 2,
  },

  newChatButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#171d25",
    justifyContent: "center",
    alignItems: "center",
  },

  chat: {
    flex: 1,
  },

  chatContent: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 15,
  },

  emptyChat: {
    flexGrow: 1,
    justifyContent: "center",
  },

  welcome: {
    alignItems: "center",
    paddingHorizontal: 25,
  },

  bigLogo: {
    width: 82,
    height: 82,
    borderRadius: 25,
    backgroundColor: "#1f6feb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },

  bigLogoText: {
    color: "#ffffff",
    fontSize: 46,
    fontWeight: "900",
  },

  welcomeTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },

  welcomeText: {
    color: "#8f99a6",
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
  },

  messageRow: {
    flexDirection: "row",
    marginBottom: 18,
    alignItems: "flex-start",
  },

  userRow: {
    justifyContent: "flex-end",
  },

  aiRow: {
    justifyContent: "flex-start",
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },

  userAvatar: {
    backgroundColor: "#303742",
    marginLeft: 8,
    order: 2,
  },

  aiAvatar: {
    backgroundColor: "#1f6feb",
    marginRight: 9,
  },

  avatarText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  messageBox: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  userMessage: {
    backgroundColor: "#1d4f91",
  },

  aiMessage: {
    backgroundColor: "#151b23",
    borderWidth: 1,
    borderColor: "#222a35",
  },

  messageText: {
    color: "#f2f5f8",
    fontSize: 15.5,
    lineHeight: 23,
  },

  speakerButton: {
    marginTop: 9,
    alignSelf: "flex-start",
    padding: 3,
  },

  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 7,
  },

  loadingText: {
    color: "#8f99a6",
    fontSize: 12,
    marginLeft: 8,
  },

  composerArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#202630",
    backgroundColor: "#0b0f14",
  },

  plusButton: {
    width: 44,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#171d25",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 7,
  },

  inputContainer: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    borderRadius: 17,
    backgroundColor: "#171d25",
    borderWidth: 1,
    borderColor: "#28303b",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 13,
    paddingRight: 6,
  },

  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    minHeight: 45,
    maxHeight: 120,
    paddingTop: 11,
    paddingBottom: 10,
  },

  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#1f6feb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },
});
