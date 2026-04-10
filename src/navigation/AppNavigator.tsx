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
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { DailyQuestsScreen } from '../screens/DailyQuestsScreen';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneContainerStyle: { backgroundColor: theme.colors.background },
          tabBarStyle: { 
            backgroundColor: theme.colors.surface, 
            borderTopColor: theme.colors.surfaceLight,
            height: 60,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: any;

            if (route.name === 'Treinamento') {
              iconName = focused ? 'fitness' : 'fitness-outline';
            } else if (route.name === 'Missões') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Enfermaria') {
              iconName = focused ? 'medkit' : 'medkit-outline';
            } else if (route.name === 'Vila') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Loja') {
              iconName = focused ? 'cart' : 'cart-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Vila"
          component={VillageScreen}
          options={{ tabBarLabel: 'Vila' }}
        />
        <Tab.Screen
          name="Treinamento"
          component={TrainingScreen}
          options={{ tabBarLabel: 'Treino' }}
        />
        <Tab.Screen
          name="Missões"
          component={MissionsScreen}
          options={{ tabBarLabel: 'Missões' }}
        />
        <Tab.Screen
          name="Enfermaria"
          component={EnfermariaScreen}
          options={{ tabBarLabel: 'Saúde' }}
        />
        <Tab.Screen 
          name="Loja" 
          component={ShopScreen} 
          options={{ tabBarLabel: 'Loja' }} 
        />
        
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
        <Tab.Screen
          name="Conquistas"
          component={AchievementsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="MissoesDiarias"
          component={DailyQuestsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
