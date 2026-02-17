import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { TrainingScreen } from '../screens/TrainingScreen';
import { MissionsScreen } from '../screens/MissionsScreen';
import { theme } from '../theme';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.surfaceLight },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
        }}
      >
        <Tab.Screen
          name="Treinamento"
          component={TrainingScreen}
          options={{ tabBarLabel: 'Treinamento' }}
        />
        <Tab.Screen
          name="Missões"
          component={MissionsScreen}
          options={{ tabBarLabel: 'Missões' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

