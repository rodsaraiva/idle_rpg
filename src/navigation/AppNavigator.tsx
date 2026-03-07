import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { TrainingScreen } from '../screens/TrainingScreen';
import { MissionsScreen } from '../screens/MissionsScreen';
import { EnfermariaScreen } from '../screens/EnfermariaScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { VillageScreen } from '../screens/VillageScreen';
import { BlacksmithScreen } from '../screens/BlacksmithScreen';
import { PantheonScreen } from '../screens/PantheonScreen';
import { theme } from '../theme';

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
        <Tab.Screen
          name="Enfermaria"
          component={EnfermariaScreen}
          options={{ tabBarLabel: 'Enfermaria' }}
        />
        <Tab.Screen name="Vila" component={VillageScreen} options={{ tabBarLabel: 'Vila' }} />
        {/* Hidden routes for Ferreiro and Panteão - navigated to from Vila but not shown as tabs */}
        <Tab.Screen
          name="Ferreiro"
          component={BlacksmithScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Panteao"
          component={PantheonScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen name="Loja" component={ShopScreen} options={{ tabBarLabel: 'Loja' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
